import pytest

KEY = "test-internal-key"


@pytest.fixture(autouse=True)
def _internal_key(settings):
    settings.AI_INTERNAL_KEY = KEY


def test_health_requires_internal_key(client):
    res = client.get("/internal/health")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == "UNAUTHENTICATED"


def test_health_rejects_wrong_key(client):
    res = client.get("/internal/health", headers={"X-Internal-Key": "wrong"})
    assert res.status_code == 401


def test_health_fails_closed_when_key_not_configured(client, settings):
    settings.AI_INTERNAL_KEY = ""
    res = client.get("/internal/health", headers={"X-Internal-Key": ""})
    assert res.status_code == 401


def test_health_ok_with_key(client, settings, tmp_path):
    settings.MODEL_PATH = str(tmp_path / "missing.tflite")
    settings.LLM_PROVIDER = "gemini"
    settings.LLM_API_KEY = ""
    settings.MONGODB_URI_READONLY = ""
    res = client.get("/internal/health", headers={"X-Internal-Key": KEY})
    assert res.status_code == 200
    assert res.json() == {
        "status": "ok",
        "modelReady": False,
        "modelVersion": None,
        "llmProvider": "gemini",
        "llmConfigured": False,
        "groundingConfigured": False,
    }


def test_health_reports_model_version_from_model_card(client, settings, tmp_path):
    model = tmp_path / "civic_cnn_v3.tflite"
    model.write_bytes(b"\x00")
    (tmp_path / "model_card.json").write_text('{"modelVersion": "civic_cnn_v3"}')
    settings.MODEL_PATH = str(model)
    res = client.get("/internal/health", headers={"X-Internal-Key": KEY})
    assert res.json()["modelVersion"] == "civic_cnn_v3"
    assert res.json()["modelReady"] is False


def test_public_health_needs_no_key_and_reveals_nothing(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_liveness_allows_platform_probe_and_sends_hsts_over_https(client, settings):
    settings.SECURE_SSL_REDIRECT = True
    settings.SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    settings.SECURE_HSTS_SECONDS = 31_536_000

    assert client.get("/health").status_code == 200
    res = client.get("/health", headers={"X-Forwarded-Proto": "https"})
    assert res.status_code == 200
    assert res["Strict-Transport-Security"].startswith("max-age=31536000")
    assert res["X-Frame-Options"] == "DENY"
