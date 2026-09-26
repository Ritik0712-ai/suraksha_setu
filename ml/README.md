# Complaint-photo CNN (training pipeline)

Trains the 7-class classifier the AI service uses to suggest a complaint category (doc 06 tasks 4B.1–4B.3, docs/02 §4.3). None of this runs in production: only the exported `.tflite` and its `model_card.json` ship.

Classes (order matters, from `shared/constants.json` `complaintCategories`): `road_damage`, `garbage`, `streetlight`, `waterlogging`, `water_supply` (handpumps and taps), `encroachment`, `other`.

## 1. Dataset (4B.1)

| Class        | Sources                                                            |
| ------------ | ------------------------------------------------------------------ |
| road_damage  | RDD2022 India subset (potholes, cracks)                            |
| garbage      | Open Images V7 (garbage, waste container), field visit             |
| streetlight  | Open Images V7 (street light), field visit                         |
| waterlogging | Web images with a reuse licence, field visit                       |
| water_supply | **Field visit** (handpumps, leaking taps, tanks) — few public sets |
| encroachment | Field visit, web images with a reuse licence                       |
| other        | Mixed village scenes that fit no class                             |

- Target **≥ 300 images per class after cleaning**. Balance matters more than volume; class weights help but don't fix a class with 40 images.
- Field-visit photos: ask before taking a photo, keep faces and number plates out of frame, and record consent in the visit notes. `prepare_dataset.py` re-encodes every image and strips EXIF, so no GPS ends up in the dataset.
- Keep raw photos in the team Google Drive, **never in git**. Lay them out as `<source>/<class>/*.jpg`.

```bash
python ml/prepare_dataset.py --sources raw/rdd2022_india raw/open_images raw/field_visit_1 --out data/v1
```

It drops unreadable, tiny (< 128 px) and near-duplicate images, splits 70/15/15 per class (seeded) and writes `data/v1/manifest.json` with counts per class and split. Check those counts before training.

## 2. Train and evaluate (4B.2)

Use the Colab notebook [`notebooks/train_colab.ipynb`](notebooks/train_colab.ipynb) (Runtime → GPU). It runs these steps:

```bash
pip install -r ml/requirements.txt
python ml/train_cnn.py --data data/v1 --out runs/v1          # MobileNetV2, 2 phases
python ml/evaluate.py  --model runs/v1/best.keras --data data/v1 --out runs/v1
```

- Phase 1: frozen MobileNetV2 (ImageNet) + new head, Adam 1e-3, up to 20 epochs.
- Phase 2: unfreeze the top 30 layers (BatchNorm stays frozen), Adam 1e-5, up to 15 epochs. Early stopping on `val_accuracy`.
- Augmentation: horizontal flips, small rotations, zoom and brightness (phone photos in daylight and at dusk).
- The model takes **raw RGB 0–255** at 224×224 (scaling is inside the model), so the AI service and the export check don't have to agree on preprocessing.
- `evaluate.py` writes `metrics.json` (accuracy, macro F1, per-class precision/recall/F1) and `confusion_matrix.csv`. Target: **test accuracy ≥ 0.87** (docs/01 §8.2). Put the numbers and the confusion matrix in the review.

## 3. Export and release (4B.3)

```bash
python ml/export_tflite.py --model runs/v1/best.keras --data data/v1 --version 1 \
  --metrics runs/v1/metrics.json --out dist
```

- Writes `dist/civic_cnn_v1.tflite` (float16, ~5 MB) and `dist/model_card.json` (version, classes, input format, metrics, dataset manifest summary).
- It refuses to write the file if the `.tflite` and Keras models disagree on more than 5% of test images.
- Publish both files as assets of a GitHub Release tagged `model-v1`. Then set on the AI service (Render):
  - `MODEL_URL` → the `.tflite` asset URL
  - `MODEL_CARD_URL` → the `model_card.json` asset URL

  The build runs `python scripts/fetch_model.py`, which downloads both into `apps/ai/models/`. The service refuses a model whose `classes` differ from `shared/constants.json`.

- Never commit a real model to git (`*.tflite` is ignored). The only tracked model is the 2 KB test fixture in `apps/ai/core/tests/fixtures/`.

## Check the pipeline without a dataset

```bash
python ml/smoke_test.py
```

It builds a tiny synthetic dataset and runs prepare → train (no pretrained weights, 3 epochs) → evaluate → export end to end. It checks that the scripts fit together, not accuracy.

## v2 (4B.10)

Retrain in Semester 6 with pilot photos (with the citizen's consent, from `uploads` of resolved complaints) and the categories authorities corrected (`categorySource = authority_corrected`). Bump `--version`, publish `model-v2`, and switch `MODEL_URL`, `MODEL_CARD_URL` and `MODEL_PATH` (`models/civic_cnn_v2.tflite`).
