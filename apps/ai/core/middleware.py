import hmac

from django.conf import settings
from django.http import JsonResponse


class InternalKeyMiddleware:
    """Rejects any /internal/* request without the shared X-Internal-Key (docs/02 §7.3, SEC-10).

    If AI_INTERNAL_KEY is not configured, every internal request is rejected (fail closed).
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith("/internal/"):
            expected = settings.AI_INTERNAL_KEY
            given = request.headers.get("X-Internal-Key", "")
            if not expected or not hmac.compare_digest(given.encode(), expected.encode()):
                return JsonResponse(
                    {"error": {"code": "UNAUTHENTICATED", "message": "Invalid internal key"}},
                    status=401,
                )
        return self.get_response(request)
