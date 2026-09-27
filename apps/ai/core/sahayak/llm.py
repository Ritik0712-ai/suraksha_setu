"""LLM provider adapter for Sahayak (docs/02 §4.2, task 4G.1).

One small interface, several providers, chosen by the LLM_PROVIDER env var:

- ``gemini`` (default) — Google Gemini Flash-tier via the ``google-genai`` SDK, with a fallback
  model when the free tier says the model is busy.
- ``anthropic`` — Anthropic Messages API over plain HTTPS (no extra SDK).
- ``fake`` — deterministic offline replies for local development and end-to-end tests.
  Never use it in production.

Every provider receives the system prompt separately from the conversation, and the user's
text only ever travels as a ``user`` turn (docs/02 SEC-16). The model has no tools.
"""

from __future__ import annotations

import json
import logging
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field

from django.conf import settings

logger = logging.getLogger(__name__)
MAX_OUTPUT_TOKENS = 800  # docs/02 §7.5 cost control


class LLMUnavailable(Exception):
    """The provider isn't configured, or it failed / timed out. The API shows a fallback."""

    def __init__(self, message: str, *, configured: bool = True):
        super().__init__(message)
        self.configured = configured


@dataclass
class Turn:
    role: str  # "user" | "assistant"
    text: str


@dataclass
class Completion:
    text: str
    provider: str
    model: str
    tokens_in: int | None = None
    tokens_out: int | None = None
    latency_ms: int = 0
    raw: dict = field(default_factory=dict)


class Provider:
    name = "base"
    default_fallbacks: tuple[str, ...] = ()

    def __init__(
        self, *, api_key: str, model: str, timeout_s: float, fallbacks: tuple[str, ...] = ()
    ):
        self.api_key = api_key
        self.model = model
        self.timeout_s = timeout_s
        self.fallbacks = tuple(m for m in fallbacks if m and m != model)

    def complete(self, system: str, turns: list[Turn]) -> Completion:  # pragma: no cover
        raise NotImplementedError


class GeminiProvider(Provider):
    """Gemini via ``google-genai``. On the free tier Google sheds load per model ("503: this model
    is experiencing high demand", 429 quota), so when a call fails the same request goes to the
    next model in ``fallbacks`` within one shared time budget (``timeout_s``). Only a rejected key
    (401/403) stops at once. Each failure is logged with its code."""

    name = "gemini"
    # Free tier, measured 27 Sep 2026: flash-lite answered every time in 1–4 s; flash-latest is
    # often 503/504 under load. Google also rejects a per-request deadline under 10 s, so a
    # fallback is only tried while ≥ 10 s of the budget are left.
    default_model = "gemini-3.5-flash-lite"
    default_fallbacks = ("gemini-flash-latest",)
    MIN_DEADLINE_S = 10

    @staticmethod
    def _worth_retrying(err: Exception) -> bool:
        """Anything but a rejected key: busy (503/504), rate limit (429), timeouts, and model-
        specific 400/404s can all succeed on the next model."""
        return getattr(err, "code", None) not in (401, 403)

    @staticmethod
    def _describe(err: Exception | None) -> str:
        if err is None:
            return "no time left"
        code = getattr(err, "code", None)
        status = getattr(err, "status", None)
        return " ".join(str(x) for x in (type(err).__name__, code, status) if x)

    def complete(self, system: str, turns: list[Turn]) -> Completion:
        try:
            from google import genai
            from google.genai import types
        except ImportError as err:  # pragma: no cover - dependency is in requirements.txt
            raise LLMUnavailable("google-genai is not installed", configured=False) from err

        contents = [
            types.Content(
                role="model" if t.role == "assistant" else "user",
                parts=[types.Part(text=t.text)],
            )
            for t in turns
        ]
        config = types.GenerateContentConfig(
            system_instruction=system,
            max_output_tokens=MAX_OUTPUT_TOKENS,
            temperature=0.3,
            response_mime_type="application/json",
        )
        started = time.monotonic()
        deadline = started + self.timeout_s
        models = (self.model, *self.fallbacks)
        last: Exception | None = None
        for model in models:
            left = deadline - time.monotonic()
            if left < self.MIN_DEADLINE_S:
                break
            client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=int(left * 1000)),
            )
            try:
                resp = client.models.generate_content(model=model, contents=contents, config=config)
            except Exception as err:  # SDK raises several error types; all mean "no reply"
                last = err
                logger.info("gemini %s failed: %s", model, self._describe(err))
                if self._worth_retrying(err):
                    continue
                break
            usage = getattr(resp, "usage_metadata", None)
            return Completion(
                text=resp.text or "",
                provider=self.name,
                model=model,
                tokens_in=getattr(usage, "prompt_token_count", None),
                tokens_out=getattr(usage, "candidates_token_count", None),
                latency_ms=int((time.monotonic() - started) * 1000),
            )
        raise LLMUnavailable(f"gemini call failed: {self._describe(last)}") from last


class AnthropicProvider(Provider):
    name = "anthropic"
    default_model = "claude-haiku-4-5-20251001"
    url = "https://api.anthropic.com/v1/messages"

    def complete(self, system: str, turns: list[Turn]) -> Completion:
        body = {
            "model": self.model,
            "max_tokens": MAX_OUTPUT_TOKENS,
            "temperature": 0.3,
            "system": system,
            "messages": [{"role": t.role, "content": t.text} for t in turns],
        }
        req = urllib.request.Request(  # noqa: S310 (fixed https URL)
            self.url,
            data=json.dumps(body).encode(),
            headers={
                "content-type": "application/json",
                "x-api-key": self.api_key,
                "anthropic-version": "2023-06-01",
            },
            method="POST",
        )
        started = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout_s) as res:  # noqa: S310
                data = json.loads(res.read().decode())
        except (urllib.error.URLError, TimeoutError, ValueError) as err:
            raise LLMUnavailable(f"anthropic call failed: {type(err).__name__}") from err
        text = "".join(
            b.get("text", "") for b in data.get("content", []) if b.get("type") == "text"
        )
        usage = data.get("usage", {})
        return Completion(
            text=text,
            provider=self.name,
            model=self.model,
            tokens_in=usage.get("input_tokens"),
            tokens_out=usage.get("output_tokens"),
            latency_ms=int((time.monotonic() - started) * 1000),
        )


class FakeProvider(Provider):
    """Offline stand-in: answers from the grounded scheme list so the whole chat flow can be
    exercised without a key. Recognises the letter flow and returns a letter after enough turns.
    """

    name = "fake"
    default_model = "fake-1"

    def complete(self, system: str, turns: list[Turn]) -> Completion:
        last = turns[-1].text if turns else ""
        hindi = "LANGUAGE: hi" in system
        slugs = [
            line.split(":", 1)[1].strip()
            for line in system.splitlines()
            if line.startswith("SLUG:")
        ]
        if "MODE: letter" in system:
            user_turns = [t.text for t in turns if t.role == "user"]
            if len(user_turns) >= 2:
                reply = {
                    "intent": "letter_ready",
                    "text": "आपका पत्र तैयार है।" if hindi else "Your letter is ready.",
                    "letter": {
                        "to": "श्रीमान सरपंच/सचिव महोदय, ग्राम पंचायत",
                        "subject": "हैंडपंप की मरम्मत हेतु आवेदन",
                        "body": "निवेदन है कि हमारे मोहल्ले का हैंडपंप खराब है। "
                        "कृपया इसे जल्द ठीक करवाएँ।",
                        "applicantName": user_turns[0][:60],
                        "includeMobile": False,
                    },
                }
            else:
                reply = {
                    "intent": "need_info",
                    "text": "समस्या क्या है?" if hindi else "What is the problem?",
                    "chips": [],
                }
        elif slugs:
            reply = {
                "intent": "answer",
                "text": (
                    "यह योजना आपके काम की हो सकती है।" if hindi else "This scheme may help you."
                )
                + f" ({last[:40]})",
                "cards": slugs[:2],
            }
        else:
            reply = {
                "intent": "answer",
                "text": (
                    "मेरी सूची में इसकी जानकारी नहीं है। कृपया आधिकारिक पोर्टल देखें।"
                    if hindi
                    else "I don't have this in my list. Please check the official portal."
                ),
            }
        return Completion(
            text=json.dumps(reply, ensure_ascii=False),
            provider=self.name,
            model=self.model,
            tokens_in=len(system) // 4,
            tokens_out=40,
        )


PROVIDERS: dict[str, type[Provider]] = {
    "gemini": GeminiProvider,
    "anthropic": AnthropicProvider,
    "fake": FakeProvider,
}


def get_provider() -> Provider:
    """The provider from settings. Raises LLMUnavailable(configured=False) when unusable."""
    name = (settings.LLM_PROVIDER or "").strip().lower()
    cls = PROVIDERS.get(name)
    if cls is None:
        raise LLMUnavailable(f"unknown LLM_PROVIDER {name!r}", configured=False)
    if cls is not FakeProvider and not settings.LLM_API_KEY:
        raise LLMUnavailable("LLM_API_KEY is not set", configured=False)
    fallbacks = [m.strip() for m in (settings.LLM_FALLBACK_MODELS or "").split(",") if m.strip()]
    return cls(
        api_key=settings.LLM_API_KEY,
        model=settings.LLM_MODEL or cls.default_model,
        timeout_s=settings.LLM_TIMEOUT_S,
        fallbacks=tuple(fallbacks) if fallbacks else cls.default_fallbacks,
    )
