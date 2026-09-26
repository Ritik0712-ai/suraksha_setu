import json
import logging
from pathlib import Path

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .classifier import ModelUnavailable, get_classifier
from .images import ImageRejected, fetch_image

logger = logging.getLogger(__name__)


def _error(code: str, message: str, http_status: int) -> Response:
    return Response({"error": {"code": code, "message": message}}, status=http_status)


def _model_version() -> str | None:
    """Version from the loaded model, else from model_card.json if the file is there."""
    try:
        return get_classifier().version
    except ModelUnavailable:
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


class ClassifyRequest(serializers.Serializer):
    imageUrl = serializers.URLField(max_length=2000)  # noqa: N815 (API field name)


@api_view(["POST"])
def classify(request):
    """POST /internal/classify { imageUrl } → { category, confidence, top3, modelVersion,
    inferenceMs } (docs/02 §7.3). The Node API treats any failure as "no suggestion"."""
    body = ClassifyRequest(data=request.data)
    if not body.is_valid():
        return _error(
            "VALIDATION_ERROR", "imageUrl must be a valid URL", status.HTTP_400_BAD_REQUEST
        )
    try:
        classifier = get_classifier()
    except ModelUnavailable as err:
        logger.warning("classify without a model: %s", err)
        return _error(
            "MODEL_UNAVAILABLE", "no model is loaded", status.HTTP_503_SERVICE_UNAVAILABLE
        )
    try:
        image = fetch_image(body.validated_data["imageUrl"])
    except ImageRejected as err:
        code = (
            status.HTTP_502_BAD_GATEWAY
            if err.code == "FETCH_FAILED"
            else status.HTTP_400_BAD_REQUEST
        )
        return _error(err.code, str(err), code)
    return Response(classifier.predict(image))
