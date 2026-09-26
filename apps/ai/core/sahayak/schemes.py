"""Scheme grounding for Sahayak (docs/02 §4.2 "Grounding", task 4G.2).

The published catalogue is small (≤ 50 schemes), so there is no vector database: we load the
published schemes from MongoDB with a read-only user, pick the ones most relevant to the
conversation by simple keyword/category overlap, and put them in the prompt. Answers stay
traceable to our own verified records.
"""

from __future__ import annotations

import logging
import re
import threading
import time
from collections.abc import Iterable

from django.conf import settings

logger = logging.getLogger(__name__)

CACHE_SECONDS = 300
MAX_IN_PROMPT = 8

_FIELDS = {
    "_id": 1,
    "slug": 1,
    "name": 1,
    "summary": 1,
    "benefitShort": 1,
    "benefits": 1,
    "eligibilityText": 1,
    "documents": 1,
    "howToApply": 1,
    "whereToApply": 1,
    "officialUrl": 1,
    "sourceName": 1,
    "helpline": 1,
    "categories": 1,
    "level": 1,
    "tags": 1,
    "lastVerifiedAt": 1,
}

# A few everyday words that point at a scheme category even when no name is mentioned.
CATEGORY_WORDS = {
    "women": ["महिला", "बहन", "बेटी", "स्त्री", "mahila", "behna", "woman", "women", "ladki"],
    "farmers": ["किसान", "खेती", "फसल", "kisan", "kheti", "farmer", "crop", "fasal"],
    "health": ["इलाज", "अस्पताल", "बीमारी", "स्वास्थ्य", "ilaj", "hospital", "health", "bimari"],
    "housing": ["घर", "मकान", "आवास", "ghar", "makan", "awas", "house", "housing"],
    "education": ["पढ़ाई", "स्कूल", "छात्र", "padhai", "school", "student", "scholarship"],
    "pension": ["पेंशन", "बुज़ुर्ग", "वृद्ध", "विधवा", "pension", "old", "vidhwa", "widow"],
    "employment": ["रोज़गार", "काम", "मज़दूरी", "rozgar", "kaam", "job", "work", "mgnrega"],
}

_WORD = re.compile(r"[\wऀ-ॿ]+", re.UNICODE)


def _words(text: str) -> set[str]:
    return {w.lower() for w in _WORD.findall(text or "") if len(w) > 1}


class MongoSchemeSource:
    """Reads published schemes with the read-only user, cached for a few minutes."""

    def __init__(self, uri: str):
        self.uri = uri
        self._client = None
        self._cache: list[dict] | None = None
        self._at = 0.0
        self._lock = threading.Lock()

    def _collection(self):
        if self._client is None:
            from pymongo import MongoClient

            self._client = MongoClient(self.uri, serverSelectionTimeoutMS=3000, appname="ss-ai")
        return self._client.get_default_database()["schemes"]

    def published(self) -> list[dict]:
        with self._lock:
            if self._cache is not None and time.monotonic() - self._at < CACHE_SECONDS:
                return self._cache
            try:
                docs = list(self._collection().find({"status": "published"}, _FIELDS))
            except Exception as err:  # network/auth problems → answer without grounding
                logger.warning("scheme load failed: %s", type(err).__name__)
                return self._cache or []
            for d in docs:
                d["_id"] = str(d["_id"])
            self._cache, self._at = docs, time.monotonic()
            return docs


class StaticSchemeSource:
    """In-memory source (tests, or when no read-only DB user is configured)."""

    def __init__(self, schemes: Iterable[dict] = ()):
        self.schemes = list(schemes)

    def published(self) -> list[dict]:
        return list(self.schemes)


_source = None
_source_lock = threading.Lock()


def get_scheme_source():
    global _source
    with _source_lock:
        if _source is None:
            uri = settings.MONGODB_URI_READONLY
            _source = MongoSchemeSource(uri) if uri else StaticSchemeSource()
        return _source


def set_scheme_source(source) -> None:
    """Replace the source (tests)."""
    global _source
    with _source_lock:
        _source = source


def _text_of(s: dict) -> str:
    parts = [s.get("slug", "").replace("-", " ")]
    for key in ("name", "summary", "benefitShort"):
        v = s.get(key) or {}
        parts += [v.get("hi", ""), v.get("en", "")]
    parts += s.get("tags") or []
    return " ".join(parts)


def select_relevant(
    schemes: list[dict],
    conversation: str,
    pinned_ids: Iterable[str] = (),
    limit: int = MAX_IN_PROMPT,
) -> list[dict]:
    """Pinned schemes first (scheme_help mode), then the best keyword matches.

    With a small catalogue, every scheme that shares any word or category with the conversation
    is a candidate; ties keep the catalogue order so results are stable.
    """
    pinned = {str(i) for i in pinned_ids}
    first = [s for s in schemes if str(s.get("_id")) in pinned]
    all_words = _words(conversation)
    words = all_words - _LIST_WORDS  # "योजना" alone says nothing about which scheme
    scored: list[tuple[int, int, dict]] = []
    for idx, s in enumerate(schemes):
        if str(s.get("_id")) in pinned:
            continue
        score = 3 * len(words & _words(_text_of(s)))
        for cat in s.get("categories") or []:
            if words & set(CATEGORY_WORDS.get(cat, [])):
                score += 2
        if score:
            scored.append((-score, idx, s))
    scored.sort(key=lambda x: (x[0], x[1]))
    rest = [s for _, _, s in scored]
    # A general "which schemes can I get?" question matches nothing specific: show a spread.
    if not first and not rest and _asks_for_list(all_words):
        rest = list(schemes)
    return (first + rest)[:limit]


_LIST_WORDS = {"योजना", "योजनाएं", "योजनाएँ", "yojana", "yojna", "scheme", "schemes"}


def _asks_for_list(words: set[str]) -> bool:
    return bool(words & _LIST_WORDS)


def compact(s: dict, lang: str) -> str:
    """One scheme as plain text in the user's language, for the system prompt."""

    def loc(v):
        v = v or {}
        return v.get(lang) or v.get("en") or v.get("hi") or ""

    def lst(key):
        return "; ".join(loc(x) for x in s.get(key) or [] if loc(x))

    docs = ", ".join(loc(d.get("label")) for d in s.get("documents") or [])
    verified = s.get("lastVerifiedAt")
    verified = verified.date().isoformat() if hasattr(verified, "date") else str(verified or "")
    lines = [
        f"SLUG: {s.get('slug', '')}",
        f"NAME: {loc(s.get('name'))}",
        f"SUMMARY: {loc(s.get('summary'))}",
        f"BENEFIT: {loc(s.get('benefitShort'))}",
        f"BENEFITS: {lst('benefits')}",
        f"WHO_CAN_APPLY: {lst('eligibilityText')}",
        f"DOCUMENTS: {docs}",
        f"HOW_TO_APPLY: {lst('howToApply')}",
        f"WHERE_TO_APPLY: {lst('whereToApply')}",
        f"OFFICIAL_SITE: {s.get('officialUrl', '')} ({s.get('sourceName', '')})",
        f"LAST_CHECKED: {verified}",
    ]
    if s.get("helpline"):
        lines.append(f"HELPLINE: {s['helpline']}")
    return "\n".join(lines)
