import io
import json
import shutil
from pathlib import Path

import pytest
from PIL import Image

from core import images, views
from core.images import ImageRejected, decode_image

KEY = "test-internal-key"
FIXTURES = Path(__file__).resolve().parent / "fixtures"
URL = "https://res.cloudinary.com/demo/image/upload/c.jpg"


def _jpeg(color, size=(320, 240), fmt="JPEG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format=fmt)
    return buf.getvalue()


@pytest.fixture(autouse=True)
def _setup(settings):
    settings.AI_INTERNAL_KEY = KEY
    settings.MODEL_PATH = str(FIXTURES / "test_model.tflite")
    settings.AI_ALLOWED_IMAGE_HOSTS = ["res.cloudinary.com", "localhost"]


@pytest.fixture
def serve(monkeypatch):
    """Serves the given bytes for any allowed URL instead of going to the network."""

    def _serve(data: bytes):
        monkeypatch.setattr(views, "fetch_image", _fake_fetch(data))

    return _serve


def _fake_fetch(data):
    def fetch(url):
        images._check_url(url)
        return decode_image(data)

    return fetch


def post(client, body):
    return client.post(
        "/internal/classify",
        data=json.dumps(body),
        content_type="application/json",
        headers={"X-Internal-Key": KEY},
    )


@pytest.mark.parametrize(
    "color,expected",
    [((220, 30, 30), "road_damage"), ((30, 200, 40), "garbage"), ((20, 30, 220), "streetlight")],
)
def test_classify_returns_category_and_top3(client, serve, color, expected):
    serve(_jpeg(color))
    res = post(client, {"imageUrl": URL})
    assert res.status_code == 200
    body = res.json()
    assert body["category"] == expected
    assert body["confidence"] > 0.8
    assert body["modelVersion"] == "civic_cnn_test"
    assert len(body["top3"]) == 3
    assert body["top3"][0] == {"category": expected, "confidence": body["confidence"]}
    confidences = [t["confidence"] for t in body["top3"]]
    assert confidences == sorted(confidences, reverse=True)
    assert isinstance(body["inferenceMs"], int)


def test_grey_image_is_low_confidence(client, serve):
    serve(_jpeg((128, 128, 128)))
    body = post(client, {"imageUrl": URL}).json()
    assert body["confidence"] < 0.6


def test_png_and_webp_are_accepted(client, serve):
    for fmt in ("PNG", "WEBP"):
        serve(_jpeg((220, 30, 30), fmt=fmt))
        assert post(client, {"imageUrl": URL}).json()["category"] == "road_damage"


def test_classify_requires_internal_key(client):
    res = client.post("/internal/classify", data={"imageUrl": URL})
    assert res.status_code == 401


def test_classify_validates_body(client):
    res = post(client, {"imageUrl": "not a url"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "VALIDATION_ERROR"


def test_classify_without_model_is_503(client, settings, tmp_path):
    settings.MODEL_PATH = str(tmp_path / "missing.tflite")
    res = post(client, {"imageUrl": URL})
    assert res.status_code == 503
    assert res.json()["error"]["code"] == "MODEL_UNAVAILABLE"


def test_model_with_wrong_classes_is_refused(client, settings, tmp_path):
    shutil.copy(FIXTURES / "test_model.tflite", tmp_path / "m.tflite")
    card = json.loads((FIXTURES / "model_card.json").read_text())
    card["classes"] = list(reversed(card["classes"]))
    (tmp_path / "model_card.json").write_text(json.dumps(card))
    settings.MODEL_PATH = str(tmp_path / "m.tflite")
    assert post(client, {"imageUrl": URL}).status_code == 503


def test_other_hosts_are_refused(client):
    res = post(client, {"imageUrl": "https://169.254.169.254/latest/meta-data"})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "HOST_NOT_ALLOWED"


def test_http_only_for_local_hosts(client, serve):
    serve(_jpeg((220, 30, 30)))
    res = post(client, {"imageUrl": "http://res.cloudinary.com/demo/c.jpg"})
    assert res.json()["error"]["code"] == "INSECURE_URL"
    res = post(client, {"imageUrl": "http://localhost:5000/api/v1/files/c.jpg"})
    assert res.status_code == 200


def test_unreadable_image_is_400(client, serve):
    serve(b"definitely not an image")
    res = post(client, {"imageUrl": URL})
    assert res.status_code == 400
    assert res.json()["error"]["code"] == "BAD_IMAGE"


def test_gif_is_refused():
    buf = io.BytesIO()
    Image.new("RGB", (10, 10)).save(buf, format="GIF")
    with pytest.raises(ImageRejected) as err:
        decode_image(buf.getvalue())
    assert err.value.code == "BAD_FORMAT"


def test_fetch_failure_is_502(client, monkeypatch):
    def boom(*_a, **_k):
        raise OSError("connection refused")

    monkeypatch.setattr(images.urllib.request, "urlopen", boom)
    res = post(client, {"imageUrl": URL})
    assert res.status_code == 502
    assert res.json()["error"]["code"] == "FETCH_FAILED"


def test_oversized_download_is_refused(monkeypatch):
    class Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *a):
            return False

    monkeypatch.setattr(
        images.urllib.request, "urlopen", lambda *a, **k: Resp(b"x" * (images.MAX_BYTES + 10))
    )
    with pytest.raises(ImageRejected) as err:
        images.fetch_image(URL)
    assert err.value.code == "TOO_LARGE"


def test_health_reports_loaded_model(client):
    res = client.get("/internal/health", headers={"X-Internal-Key": KEY})
    assert res.json()["modelVersion"] == "civic_cnn_test"
