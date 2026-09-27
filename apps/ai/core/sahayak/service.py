"""Sahayak reply orchestration: prompt → LLM → validated, structured reply (docs/02 §7.3)."""

from __future__ import annotations

import json
import logging
import re

from ..constants import get_constants
from .llm import Completion, LLMUnavailable, Turn, get_provider
from .prompt import build_system_prompt
from .schemes import compact, get_scheme_source, select_relevant

logger = logging.getLogger(__name__)

MAX_TEXT = 4000
MAX_CARDS = 3
MAX_CHIPS = 5
MAX_HISTORY = 10  # docs/02 §4.4


def _clip(v, n):
    return v.strip()[:n] if isinstance(v, str) else ""


def _turns(history: list[dict], message: str) -> list[Turn]:
    """Last 10 turns + the new message; merges same-role neighbours and drops leading
    assistant turns so every provider accepts the sequence."""
    turns: list[Turn] = []
    for h in history[-MAX_HISTORY:]:
        role = "assistant" if h.get("role") == "assistant" else "user"
        text = _clip(h.get("text"), MAX_TEXT)
        if not text:
            continue
        if turns and turns[-1].role == role:
            turns[-1] = Turn(role, f"{turns[-1].text}\n{text}")
        else:
            turns.append(Turn(role, text))
    while turns and turns[0].role == "assistant":
        turns.pop(0)
    if turns and turns[-1].role == "user":
        turns[-1] = Turn("user", f"{turns[-1].text}\n{message}")
    else:
        turns.append(Turn("user", message))
    return turns


_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)
# The app prints the salutation itself (docs/03 S-26), so a model that repeats it is trimmed.
_SALUTATION = re.compile(
    r"^\s*(?:आदरणीय\s+)?(?:महोदय|महोदया|श्रीमान\s*जी|respected\s+sir|sir\s*/\s*madam|dear\s+sir"
    r"|sir|madam)(?![\w\u0900-\u097F])\s*[,।:!]?\s*",
    re.IGNORECASE,
)


def parse_reply(raw: str, allowed_slugs: set[str]) -> dict:
    """Validates the model's JSON. Anything malformed degrades to a plain answer, and scheme
    cards are limited to slugs we actually sent (so the model can't link to made-up pages)."""
    intents = get_constants()["chatIntents"]
    text = (raw or "").strip()
    data = None
    try:
        data = json.loads(_FENCE.sub("", text))
    except ValueError:
        start, end = text.find("{"), text.rfind("}")
        if start != -1 and end > start:
            try:
                data = json.loads(text[start : end + 1])
            except ValueError:
                data = None
    if not isinstance(data, dict):
        return {"intent": "answer", "text": _clip(text, MAX_TEXT), "cards": [], "chips": []}

    intent = data.get("intent") if data.get("intent") in intents else "answer"
    reply = {
        "intent": intent,
        "text": _clip(data.get("text"), MAX_TEXT),
        "cards": [
            s
            for s in dict.fromkeys(data.get("cards") or [])
            if isinstance(s, str) and s in allowed_slugs
        ][:MAX_CARDS],
        "chips": [
            _clip(c, 60) for c in (data.get("chips") or []) if isinstance(c, str) and c.strip()
        ][:MAX_CHIPS],
    }
    if intent != "need_info":
        reply["chips"] = []
    if intent == "letter_ready":
        letter = data.get("letter") if isinstance(data.get("letter"), dict) else {}
        clean = {
            "to": _clip(letter.get("to"), 300),
            "subject": _clip(letter.get("subject"), 200),
            "body": _SALUTATION.sub("", _clip(letter.get("body"), 3000), count=1).strip(),
            "applicantName": _clip(letter.get("applicantName"), 120),
            "includeMobile": letter.get("includeMobile") is True,
        }
        if all(clean[k] for k in ("to", "subject", "body", "applicantName")):
            reply["letter"] = clean
        else:
            # A letter with missing parts is not ready: ask again instead of showing a bad one.
            reply["intent"] = "need_info"
    if not reply["text"]:
        reply["text"] = "…"
    return reply


def reply(payload: dict) -> dict:
    """payload = validated /internal/sahayak/reply body. Raises LLMUnavailable."""
    provider = get_provider()
    language = payload["language"]
    mode = payload["mode"]
    history = payload.get("history") or []
    message = payload["message"]
    pinned = payload.get("schemeIds") or []

    schemes = get_scheme_source().published()
    conversation = " ".join([h.get("text", "") for h in history[-4:]] + [message])
    chosen = select_relevant(schemes, conversation, pinned)
    blocks = [compact(s, language) for s in chosen]
    scheme_name = None
    if mode == "scheme_help" and chosen and str(chosen[0].get("_id")) in {str(p) for p in pinned}:
        scheme_name = (chosen[0].get("name") or {}).get(language) or chosen[0].get("slug")

    system = build_system_prompt(
        language=language,
        mode=mode,
        user_context=payload.get("userContext") or {},
        scheme_blocks=blocks,
        letter_type=payload.get("letterType"),
        scheme_name=scheme_name,
    )
    completion: Completion = provider.complete(system, _turns(history, message))
    out = parse_reply(completion.text, {s.get("slug") for s in chosen})
    out["llm"] = {
        "provider": completion.provider,
        "model": completion.model,
        "tokensIn": completion.tokens_in,
        "tokensOut": completion.tokens_out,
        "latencyMs": completion.latency_ms,
    }
    logger.info(
        "sahayak reply intent=%s schemes=%d tokens=%s/%s ms=%s",
        out["intent"],
        len(chosen),
        completion.tokens_in,
        completion.tokens_out,
        completion.latency_ms,
    )
    return out


__all__ = ["LLMUnavailable", "parse_reply", "reply"]
