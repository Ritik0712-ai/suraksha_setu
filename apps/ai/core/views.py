import json
import logging
from pathlib import Path

from django.conf import settings
from rest_framework import serializers, status
from rest_framework.decorators import api_view
from rest_framework.response import Response

from .classifier import ModelUnavailable, get_classifier
from .constants import get_constants
from .images import ImageRejected, fetch_image
from .sahayak import service as sahayak

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
            "llmConfigured": settings.LLM_PROVIDER == "fake" or bool(settings.LLM_API_KEY),
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


class _HistoryItem(serializers.Serializer):
    role = serializers.ChoiceField(choices=["user", "assistant"])
    text = serializers.CharField(max_length=4000, trim_whitespace=True)


class _UserContext(serializers.Serializer):
    village = serializers.CharField(max_length=120, required=False, allow_blank=True)
    gp = serializers.CharField(max_length=120, required=False, allow_blank=True)
    block = serializers.CharField(max_length=120, required=False, allow_blank=True)
    district = serializers.CharField(max_length=120, required=False, allow_blank=True)


class SahayakRequest(serializers.Serializer):
    language = serializers.ChoiceField(choices=["hi", "en"])
    mode = serializers.CharField()
    history = _HistoryItem(many=True, required=False, max_length=10)
    message = serializers.CharField(max_length=1000)
    schemeIds = serializers.ListField(  # noqa: N815 (API field name)
        child=serializers.RegexField(r"^[a-f0-9]{24}$"), required=False, max_length=5
    )
    letterType = serializers.CharField(  # noqa: N815
        required=False, allow_null=True, allow_blank=True
    )
    userContext = _UserContext(required=False)  # noqa: N815

    def validate_mode(self, v):
        if v not in get_constants()["chatModes"]:
            raise serializers.ValidationError("invalid mode")
        return v

    def validate_letterType(self, v):  # noqa: N802
        if v and v not in get_constants()["letterTypes"]:
            raise serializers.ValidationError("invalid letter type")
        return v or None


@api_view(["POST"])
def sahayak_reply(request):
    """POST /internal/sahayak/reply (docs/02 §7.3) → { text, intent, cards, chips, letter?,
    llm }. 503 LLM_UNAVAILABLE when no provider is configured or the provider fails; the Node API
    then shows the "Sahayak is resting" / "Couldn't get a reply" fallbacks (docs/03 S-25)."""
    body = SahayakRequest(data=request.data)
    if not body.is_valid():
        return Response(
            {
                "error": {
                    "code": "VALIDATION_ERROR",
                    "message": "invalid body",
                    "details": body.errors,
                }
            },
            status=status.HTTP_400_BAD_REQUEST,
        )
    try:
        return Response(sahayak.reply(body.validated_data))
    except sahayak.LLMUnavailable as err:
        logger.warning("sahayak unavailable: %s", err)
        return Response(
            {
                "error": {
                    "code": "LLM_UNAVAILABLE" if err.configured else "LLM_NOT_CONFIGURED",
                    "message": "Sahayak is not available",
                }
            },
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
