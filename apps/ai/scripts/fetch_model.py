"""Downloads the model + model card at build time (docs/02 §9.2: kept out of git).

Render build command: pip install -r requirements.txt && python scripts/fetch_model.py
Does nothing (and exits 0) when MODEL_URL isn't set, so the service still starts and the app
falls back to manual categories.
"""

import os
import sys
import urllib.request
from pathlib import Path

model_url = os.environ.get("MODEL_URL")
card_url = os.environ.get("MODEL_CARD_URL")
target = Path(os.environ.get("MODEL_PATH", "models/civic_cnn_v1.tflite"))

if not model_url or not card_url:
    print("MODEL_URL / MODEL_CARD_URL not set — skipping model download")
    sys.exit(0)

target.parent.mkdir(parents=True, exist_ok=True)
for url, dest in ((model_url, target), (card_url, target.with_name("model_card.json"))):
    print(f"downloading {url} → {dest}")
    urllib.request.urlretrieve(url, dest)  # noqa: S310 (our own release assets)
print("model ready")
