"""Complaint-photo classifier on the LiteRT (TensorFlow Lite) runtime (docs/02 §4.3, ADR-07).

The model takes a 224x224 RGB image with raw 0-255 pixels (scaling is inside the model) and
returns 7 probabilities in shared/constants.json complaintCategories order. model_card.json next
to the .tflite must list the same classes, or the model is refused.
"""

import json
import logging
import threading
import time
from pathlib import Path

import numpy as np
from django.conf import settings
from PIL import Image, ImageOps

from .constants import complaint_categories

logger = logging.getLogger(__name__)

try:  # LiteRT, formerly tflite-runtime (docs/02 §4.2)
    from ai_edge_litert.interpreter import Interpreter
except ImportError:  # pragma: no cover - fallback runtime
    from tflite_runtime.interpreter import Interpreter  # type: ignore[no-redef]


class ModelUnavailable(Exception):
    """No model file, or a model that doesn't match the class list."""


class Classifier:
    def __init__(self, model_path: str):
        path = Path(model_path)
        card_path = path.with_name("model_card.json")
        if not path.exists() or not card_path.exists():
            raise ModelUnavailable(f"model or model_card.json missing at {path.parent}")
        card = json.loads(card_path.read_text(encoding="utf-8"))
        classes = complaint_categories()
        if card.get("classes") != classes:
            raise ModelUnavailable("model_card classes don't match shared/constants.json")

        self.classes = classes
        self.version = card.get("modelVersion", path.stem)
        self._interpreter = Interpreter(model_path=str(path), num_threads=2)
        self._interpreter.allocate_tensors()
        self._input = self._interpreter.get_input_details()[0]
        self._output = self._interpreter.get_output_details()[0]
        self.size = int(self._input["shape"][1])
        self._lock = threading.Lock()  # one interpreter, shared by gunicorn threads

    def preprocess(self, image: Image.Image) -> np.ndarray:
        img = ImageOps.exif_transpose(image).convert("RGB")
        img = img.resize((self.size, self.size), Image.Resampling.BILINEAR)
        return np.asarray(img, dtype=np.float32)[None, ...]

    def predict(self, image: Image.Image) -> dict:
        batch = self.preprocess(image)
        started = time.perf_counter()
        with self._lock:
            self._interpreter.set_tensor(self._input["index"], batch)
            self._interpreter.invoke()
            probs = self._interpreter.get_tensor(self._output["index"])[0].astype(float)
        inference_ms = round((time.perf_counter() - started) * 1000)
        order = np.argsort(probs)[::-1]
        top3 = [
            {"category": self.classes[i], "confidence": round(float(probs[i]), 4)}
            for i in order[:3]
        ]
        return {
            "category": top3[0]["category"],
            "confidence": top3[0]["confidence"],
            "top3": top3,
            "modelVersion": self.version,
            "inferenceMs": inference_ms,
        }


_classifier: Classifier | None = None
_load_error: str | None = None
_load_lock = threading.Lock()


def get_classifier() -> Classifier:
    """Loads the model once per process. Raises ModelUnavailable (→ 503) if there is none."""
    global _classifier, _load_error
    if _classifier is not None:
        return _classifier
    with _load_lock:
        if _classifier is None:
            try:
                _classifier = Classifier(settings.MODEL_PATH)
                _load_error = None
                logger.info("loaded model %s", _classifier.version)
            except ModelUnavailable as err:
                _load_error = str(err)
                raise
    return _classifier


def reset_classifier() -> None:
    """Forget the loaded model (tests switch MODEL_PATH)."""
    global _classifier, _load_error
    with _load_lock:
        _classifier = None
        _load_error = None
