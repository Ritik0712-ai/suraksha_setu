"""Builds the train/val/test folders for the complaint CNN (doc 06 task 4B.1).

Input: one or more source folders laid out as <source>/<class>/<images>, e.g.
    raw/rdd2022_india/road_damage/*.jpg
    raw/open_images/garbage/*.jpg
    raw/field_visit_1/water_supply/*.jpg        (handpumps, taken with consent)
Class folder names must be one of shared/constants.json complaintCategories.

Output: <out>/{train,val,test}/<class>/*.jpg (70/15/15, stratified, seeded) plus
<out>/manifest.json with counts per class and split, sources and a dataset version.

Cleaning: unreadable files, images smaller than 128 px and near-duplicates (average hash) are
dropped, and every image is re-encoded as RGB JPEG with metadata removed (no GPS in the data).

    python ml/prepare_dataset.py --sources raw/rdd2022_india raw/field_visit_1 --out data/v1
"""

import argparse
import hashlib
import json
import random
import shutil
from collections import defaultdict
from datetime import UTC, datetime
from pathlib import Path

from PIL import Image, ImageOps, UnidentifiedImageError

from common import CLASSES, SEED

EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MIN_SIDE = 128
SPLITS = (("train", 0.70), ("val", 0.15), ("test", 0.15))


def average_hash(img: Image.Image, size: int = 8) -> str:
    """64-bit perceptual hash: catches the same photo saved twice at different sizes."""
    small = img.convert("L").resize((size, size), Image.Resampling.BILINEAR)
    pixels = list(small.getdata())
    mean = sum(pixels) / len(pixels)
    bits = "".join("1" if p > mean else "0" for p in pixels)
    return f"{int(bits, 2):016x}"


def load_clean(path: Path) -> Image.Image | None:
    try:
        with Image.open(path) as im:
            im = ImageOps.exif_transpose(im)  # respect phone orientation, then drop EXIF
            im = im.convert("RGB")
            if min(im.size) < MIN_SIDE:
                return None
            return im.copy()
    except (UnidentifiedImageError, OSError):
        return None


def collect(sources: list[Path]) -> tuple[dict[str, list[tuple[Path, Image.Image]]], dict]:
    by_class: dict[str, list] = defaultdict(list)
    seen: set[str] = set()
    stats = {"unreadable_or_small": 0, "duplicates": 0, "unknown_class_dirs": []}
    for source in sources:
        for class_dir in sorted(p for p in source.iterdir() if p.is_dir()):
            if class_dir.name not in CLASSES:
                stats["unknown_class_dirs"].append(str(class_dir))
                continue
            for f in sorted(class_dir.rglob("*")):
                if f.suffix.lower() not in EXTENSIONS:
                    continue
                img = load_clean(f)
                if img is None:
                    stats["unreadable_or_small"] += 1
                    continue
                h = average_hash(img)
                if h in seen:
                    stats["duplicates"] += 1
                    continue
                seen.add(h)
                by_class[class_dir.name].append((f, img))
    return by_class, stats


def split(items: list, rng: random.Random) -> dict[str, list]:
    items = items[:]
    rng.shuffle(items)
    n = len(items)
    n_train = round(n * SPLITS[0][1])
    n_val = round(n * SPLITS[1][1])
    return {
        "train": items[:n_train],
        "val": items[n_train : n_train + n_val],
        "test": items[n_train + n_val :],
    }


def main() -> None:
    ap = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    ap.add_argument("--sources", nargs="+", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--version", default=None, help="dataset version label (default: date)")
    args = ap.parse_args()

    if args.out.exists():
        shutil.rmtree(args.out)
    rng = random.Random(SEED)
    by_class, stats = collect(args.sources)
    counts: dict[str, dict[str, int]] = {}
    for cls in CLASSES:
        parts = split(by_class.get(cls, []), rng)
        counts[cls] = {}
        for split_name, items in parts.items():
            target = args.out / split_name / cls
            target.mkdir(parents=True, exist_ok=True)
            for src, img in items:
                name = hashlib.sha1(str(src).encode()).hexdigest()[:16] + ".jpg"
                img.save(target / name, "JPEG", quality=90)  # no EXIF written
            counts[cls][split_name] = len(items)

    manifest = {
        "datasetVersion": args.version or datetime.now(UTC).strftime("%Y-%m-%d"),
        "classes": CLASSES,
        "sources": [str(s) for s in args.sources],
        "counts": counts,
        "dropped": stats,
        "createdAt": datetime.now(UTC).isoformat(),
    }
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(counts, indent=2))
    low = [c for c, v in counts.items() if sum(v.values()) < 300]
    if low:
        print(f"WARNING: fewer than 300 images (doc 06 target) for: {', '.join(low)}")


if __name__ == "__main__":
    main()
