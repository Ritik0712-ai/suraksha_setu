from django.http import JsonResponse
from django.urls import include, path


def public_health(_request):
    """GET /health — for UptimeRobot and Render health checks, which can't send the internal key.
    Says only that the process is up; model and LLM details stay behind /internal/health."""
    return JsonResponse({"status": "ok"})


urlpatterns = [
    path("health", public_health, name="public-health"),
    path("internal/", include("core.urls")),
]
