import json
from pathlib import Path

from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response


def _model_version() -> str | None:
    """Reads model_card.json next to the model file, if the model has been downloaded."""
    card = Path(settings.MODEL_PATH).with_name("model_card.json")
    if not Path(settings.MODEL_PATH).exists() or not card.exists():
        return None
    try:
        return json.loads(card.read_text(encoding="utf-8")).get("modelVersion")
    except (OSError, ValueError):
        return None


@api_view(["GET"])
def health(_request):
    """GET /internal/health → { status, modelVersion, llmProvider } (docs/02 §7.3)."""
    return Response(
        {
            "status": "ok",
            "modelVersion": _model_version(),
            "llmProvider": settings.LLM_PROVIDER,
        }
    )
