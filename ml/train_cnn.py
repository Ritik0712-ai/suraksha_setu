"""Trains the complaint-photo CNN (docs/02 §4.3, doc 06 task 4B.2). Run on Colab with a T4 GPU.

Architecture: MobileNetV2 (ImageNet) → GlobalAveragePooling → Dense(256, ReLU) → Dropout(0.4)
→ Dense(128, ReLU) → Dropout(0.3) → Dense(7, softmax).
Phase 1: base frozen, 20 epochs. Phase 2: top 30 base layers unfrozen, lr = 1e-5.
Augmentation: horizontal flip, rotation ±20°, zoom, brightness ±30%.

The model takes raw RGB pixels (0–255) and does MobileNetV2's scaling itself, so the served
.tflite needs no separate preprocessing that could drift from training.

    python ml/train_cnn.py --data data/v1 --out runs/v1
"""

import argparse
import json
from pathlib import Path

import numpy as np
import tensorflow as tf

from common import CLASSES, IMAGE_SIZE, SEED


def datasets(data: Path, batch: int):
    kw = {
        "labels": "inferred",
        "label_mode": "int",
        "class_names": CLASSES,  # fixes the output order to constants.json
        "image_size": (IMAGE_SIZE, IMAGE_SIZE),
        "batch_size": batch,
        "seed": SEED,
    }
    train = tf.keras.utils.image_dataset_from_directory(data / "train", shuffle=True, **kw)
    val = tf.keras.utils.image_dataset_from_directory(data / "val", shuffle=False, **kw)
    auto = tf.data.AUTOTUNE
    return train.prefetch(auto), val.prefetch(auto)


def class_weights(data: Path) -> dict[int, float]:
    """Balances rare classes (e.g. encroachment) so the model doesn't ignore them."""
    counts = np.array([max(1, len(list((data / "train" / c).glob("*")))) for c in CLASSES])
    weights = counts.sum() / (len(CLASSES) * counts)
    return {i: float(w) for i, w in enumerate(weights)}


def build_model(weights: str | None) -> tuple[tf.keras.Model, tf.keras.Model]:
    augment = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(20 / 360),
            tf.keras.layers.RandomZoom(0.2),
            tf.keras.layers.RandomBrightness(0.3, value_range=(0, 255)),
        ],
        name="augment",
    )
    base = tf.keras.applications.MobileNetV2(
        input_shape=(IMAGE_SIZE, IMAGE_SIZE, 3), include_top=False, weights=weights
    )
    base.trainable = False

    inputs = tf.keras.Input((IMAGE_SIZE, IMAGE_SIZE, 3), name="image_rgb_0_255")
    x = augment(inputs)
    x = tf.keras.layers.Rescaling(1 / 127.5, offset=-1, name="mobilenet_v2_scale")(x)
    x = base(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(256, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.4)(x)
    x = tf.keras.layers.Dense(128, activation="relu")(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    outputs = tf.keras.layers.Dense(len(CLASSES), activation="softmax", name="probs")(x)
    return tf.keras.Model(inputs, outputs, name="civic_cnn"), base


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--batch", type=int, default=32)
    ap.add_argument("--epochs1", type=int, default=20)
    ap.add_argument("--epochs2", type=int, default=15)
    ap.add_argument("--unfreeze", type=int, default=30)
    ap.add_argument(
        "--no-pretrained", action="store_true", help="random init (smoke tests without internet)"
    )
    args = ap.parse_args()

    tf.keras.utils.set_random_seed(SEED)
    args.out.mkdir(parents=True, exist_ok=True)
    train, val = datasets(args.data, args.batch)
    model, base = build_model(None if args.no_pretrained else "imagenet")
    cw = class_weights(args.data)
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor="val_accuracy", patience=5, restore_best_weights=True
        ),
        tf.keras.callbacks.ModelCheckpoint(
            args.out / "best.keras", monitor="val_accuracy", save_best_only=True
        ),
    ]

    # Phase 1: train the new head only.
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    h1 = model.fit(
        train, validation_data=val, epochs=args.epochs1, class_weight=cw, callbacks=callbacks
    )

    # Phase 2: fine-tune the top of MobileNetV2 with a small learning rate.
    base.trainable = True
    for layer in base.layers[: -args.unfreeze]:
        layer.trainable = False
    for layer in base.layers:
        if isinstance(layer, tf.keras.layers.BatchNormalization):
            layer.trainable = False  # keep ImageNet statistics stable on a small dataset
    model.compile(
        optimizer=tf.keras.optimizers.Adam(1e-5),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    h2 = model.fit(
        train, validation_data=val, epochs=args.epochs2, class_weight=cw, callbacks=callbacks
    )

    model.save(args.out / "final.keras")
    history = {
        k: h1.history.get(k, []) + h2.history.get(k, []) for k in set(h1.history) | set(h2.history)
    }
    (args.out / "history.json").write_text(json.dumps(history, indent=2), encoding="utf-8")
    print(f"best val_accuracy: {max(history.get('val_accuracy', [0])):.3f}")


if __name__ == "__main__":
    main()
