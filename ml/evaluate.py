"""Evaluates a trained model on the held-out test split (doc 06 task 4B.2).

Writes <run>/metrics.json (accuracy, per-class precision/recall/F1, confusion matrix) and
<run>/confusion_matrix.csv. Report these honestly in the Phase I report, including weak classes.

    python ml/evaluate.py --model runs/v1/best.keras --data data/v1 --out runs/v1
"""

import argparse
import csv
import json
from pathlib import Path

import numpy as np
import tensorflow as tf
from sklearn.metrics import classification_report, confusion_matrix

from common import CLASSES, IMAGE_SIZE

TARGET_ACCURACY = 0.87  # docs/01 §8.2


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--model", type=Path, required=True)
    ap.add_argument("--data", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    model = tf.keras.models.load_model(args.model)
    test = tf.keras.utils.image_dataset_from_directory(
        args.data / "test",
        labels="inferred",
        label_mode="int",
        class_names=CLASSES,
        image_size=(IMAGE_SIZE, IMAGE_SIZE),
        batch_size=32,
        shuffle=False,
    )
    y_true = np.concatenate([y.numpy() for _, y in test])
    y_pred = np.argmax(model.predict(test, verbose=0), axis=1)

    labels = list(range(len(CLASSES)))
    report = classification_report(
        y_true, y_pred, labels=labels, target_names=CLASSES, output_dict=True, zero_division=0
    )
    cm = confusion_matrix(y_true, y_pred, labels=labels)
    metrics = {
        "accuracy": float(report["accuracy"]),
        "meetsTarget": bool(report["accuracy"] >= TARGET_ACCURACY),
        "perClass": {c: {k: round(float(v), 4) for k, v in report[c].items()} for c in CLASSES},
        "confusionMatrix": {"labels": CLASSES, "rows": cm.tolist()},
        "testImages": int(len(y_true)),
    }
    args.out.mkdir(parents=True, exist_ok=True)
    (args.out / "metrics.json").write_text(json.dumps(metrics, indent=2), encoding="utf-8")
    with open(args.out / "confusion_matrix.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["true \\ predicted", *CLASSES])
        for cls, row in zip(CLASSES, cm.tolist(), strict=True):
            w.writerow([cls, *row])
    print(f"test accuracy {metrics['accuracy']:.3f} (target {TARGET_ACCURACY})")
    for c in CLASSES:
        print(f"  {c:14s} F1 {metrics['perClass'][c]['f1-score']:.3f}")


if __name__ == "__main__":
    main()
