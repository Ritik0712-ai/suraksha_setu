"""Settings for the Suraksha Setu AI microservice (docs/02 §4.2).

This service is internal only: no browser access, no CORS, no sessions, no ORM database.
The Node API is its only client and authenticates with X-Internal-Key.
"""

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BASE_DIR.parent.parent


def _env_bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes"}


DEBUG = _env_bool("DJANGO_DEBUG", False)
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY") or ("dev-only-insecure-key" if DEBUG else "")
if not SECRET_KEY:
    raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is false")

_hosts = os.environ.get("ALLOWED_HOSTS", "localhost,127.0.0.1")
ALLOWED_HOSTS = [h.strip() for h in _hosts.split(",") if h.strip()]

AI_INTERNAL_KEY = os.environ.get("AI_INTERNAL_KEY", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "gemini")
MODEL_PATH = os.environ.get("MODEL_PATH", str(BASE_DIR / "models" / "civic_cnn_v1.tflite"))
# Hosts the classifier may download photos from (SSRF guard). Production: Cloudinary only.
_image_hosts = os.environ.get("AI_ALLOWED_IMAGE_HOSTS", "res.cloudinary.com")
AI_ALLOWED_IMAGE_HOSTS = {h.strip().lower() for h in _image_hosts.split(",") if h.strip()}
SHARED_CONSTANTS_PATH = Path(
    os.environ.get("SHARED_CONSTANTS_PATH", REPO_ROOT / "shared" / "constants.json")
)

INSTALLED_APPS = [
    "rest_framework",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "core.middleware.InternalKeyMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

# No relational database: the service only reads schemes from MongoDB (read-only user).
DATABASES = {}

LANGUAGE_CODE = "en"
TIME_ZONE = "UTC"
USE_TZ = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "UNAUTHENTICATED_USER": None,
}

SECURE_CONTENT_TYPE_NOSNIFF = True
DATA_UPLOAD_MAX_MEMORY_SIZE = 1024 * 1024  # JSON bodies only; images are fetched by URL

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": "INFO"},
}
