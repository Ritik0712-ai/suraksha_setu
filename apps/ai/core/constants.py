"""Loads shared/constants.json — the single source of enums for all three apps (docs/02 §2.4)."""

import json
from functools import lru_cache

from django.conf import settings


@lru_cache(maxsize=1)
def get_constants() -> dict:
    with open(settings.SHARED_CONSTANTS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    if len(data.get("complaintCategories", [])) != 7:
        raise RuntimeError("shared/constants.json must define the 7 complaint categories")
    return data


def complaint_categories() -> list[str]:
    """CNN class labels, in model output order."""
    return list(get_constants()["complaintCategories"])
