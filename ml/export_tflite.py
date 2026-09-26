"""Exports the trained model to a float16 LiteRT (.tflite) file + model_card.json (task 4B.3).

The .tflite is checked against the Keras model on real test images before it is written.
Upload both files as a GitHub Release asset; the AI service downloads them at build time
(apps/ai/scripts/fetch_model.py).

    python ml/export_tflite.py --model runs/v1/best.keras --data data/v1 --version 1 \
        --metrics runs/v1/metrics.json --out dist/
"""

import argparse
import json
from datetime import UTC, datetime
from pathlib import Path

import numpy as np
import tensorflow as tf
from ai_edge_litert.interpreter import Interpreter

from common import CLASSES, IMAGE_SIZE


def sample_batch(data: Path, n: int = 16) -> np.ndarray:
    ds = tf.keras.utils.image_dataset_from_directory(
        data / "test",
        labels=None,
        image_size=(IMAGE_SIZE, IMAGE_SIZE),
        batch_size=n,
        shuffle=False,
    )
    return next(iter(ds)).numpy().astype(np.float32)


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--version", type=int, required=True)
    ap.add_argument("--metrics", type=Path, help="metrics.json from evaluate.py")
    ap.add_argument("--dataset-manifest", type=Path, help="defaults to <data>/manifest.json")
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    model = tf.keras.models.load_model(args.model)
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_types = [tf.float16]  # ~half the size, tiny accuracy cost
    tflite = converter.convert()

    name = f"civic_cnn_v{args.version}"
    args.out.mkdir(parents=True, exist_ok=True)
    path = args.out / f"{name}.tflite"
    path.write_bytes(tflite)

    # The served model must agree with the trained one.
    batch = sample_batch(args.data)
    keras_pred = np.argmax(model.predict(batch, verbose=0), axis=1)
    it = Interpreter(model_path=str(path))
    it.allocate_tensors()
    inp, out = it.get_input_details()[0], it.get_output_details()[0]
    lite_pred = []
    for img in batch:
        it.set_tensor(inp["index"], img[None, ...])
        it.invoke()
        lite_pred.append(int(np.argmax(it.get_tensor(out["index"])[0])))
    agreement = float(np.mean(np.array(lite_pred) == keras_pred))
    if agreement < 0.95:
        raise SystemExit(
            f"tflite disagrees with keras on {1 - agreement:.0%} of samples; not exporting"
        )

    metrics = json.loads(args.metrics.read_text()) if args.metrics else {}
    manifest_path = args.dataset_manifest or args.data / "manifest.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}
    card = {
        "modelVersion": name,
        "classes": CLASSES,
        "input": {"size": IMAGE_SIZE, "channels": 3, "format": "rgb_0_255"},
        "architecture": "MobileNetV2 + Dense(256)-Dropout(0.4)-Dense(128)-Dropout(0.3)-Dense(7)",
        "quantization": "float16",
        "accuracy": metrics.get("accuracy"),
        "perClassF1": {c: v.get("f1-score") for c, v in metrics.get("perClass", {}).items()},
        "datasetVersion": manifest.get("datasetVersion"),
        "tfliteKerasAgreement": agreement,
        "sizeBytes": len(tflite),
        "trainedAt": datetime.now(UTC).isoformat(),
    }
    (args.out / "model_card.json").write_text(json.dumps(card, indent=2), encoding="utf-8")
    print(f"wrote {path} ({len(tflite) / 1e6:.1f} MB), agreement {agreement:.0%}")


if __name__ == "__main__":
    main()
