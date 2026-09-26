"""Shared settings for the complaint-photo CNN (docs/02 §4.3).

The class order comes from shared/constants.json (complaintCategories) and is the model's output
order. Never reorder it without retraining: the API maps output index i to that category.
"""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONSTANTS = json.loads((ROOT / "shared" / "constants.json").read_text(encoding="utf-8"))
CLASSES: list[str] = list(CONSTANTS["complaintCategories"])
IMAGE_SIZE = 224
SEED = 1337
