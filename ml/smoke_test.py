"""End-to-end check of the pipeline on tiny synthetic data — no downloads, no GPU (CPU, ~1-2 min).

Proves prepare_dataset → train_cnn → evaluate → export_tflite run and produce a .tflite +
model_card.json the AI service can load. The resulting model is meaningless: never ship it.

    python ml/smoke_test.py            # keeps output in /tmp/civic_smoke
"""

import json
import subprocess
import sys
from pathlib import Path

import numpy as np
from PIL import Image

from common import CLASSES

HERE = Path(__file__).resolve().parent
WORK = Path("/tmp/civic_smoke")


def synthetic_images(root: Path, per_class: int = 12) -> None:
    rng = np.random.default_rng(0)
    for i, cls in enumerate(CLASSES):
        d = root / "synthetic" / cls
        d.mkdir(parents=True, exist_ok=True)
        base = np.array([(i * 37) % 256, (i * 91) % 256, (i * 173) % 256], dtype=np.float32)
        for k in range(per_class):
            noise = rng.normal(0, 40, (160, 200, 3))
            img = np.clip(base + noise, 0, 255).astype(np.uint8)
            Image.fromarray(img).save(d / f"{k}.png")


def run(*args: str) -> None:
    print("$", " ".join(args), flush=True)
    subprocess.run([sys.executable, *args], check=True, cwd=HERE)


def main() -> None:
    raw, data, runs, dist = WORK / "raw", WORK / "data", WORK / "run", WORK / "dist"
    synthetic_images(raw)
    run(
        "prepare_dataset.py",
        "--sources",
        str(raw / "synthetic"),
        "--out",
        str(data),
        "--version",
        "smoke",
    )
    run(
        "train_cnn.py",
        "--data",
        str(data),
        "--out",
        str(runs),
        "--batch",
        "8",
        "--epochs1",
        "2",
        "--epochs2",
        "1",
        "--no-pretrained",
    )
    run("evaluate.py", "--model", str(runs / "best.keras"), "--data", str(data), "--out", str(runs))
    run(
        "export_tflite.py",
        "--model",
        str(runs / "best.keras"),
        "--data",
        str(data),
        "--version",
        "0",
        "--metrics",
        str(runs / "metrics.json"),
        "--out",
        str(dist),
    )
    card = json.loads((dist / "model_card.json").read_text())
    assert card["classes"] == CLASSES, "class order changed"
    assert (dist / "civic_cnn_v0.tflite").stat().st_size > 0
    print(f"smoke test OK: {dist}/civic_cnn_v0.tflite ({card['sizeBytes'] / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
