"""Fetches a complaint photo by URL for classification (docs/02 §7.3).

Only hosts on AI_ALLOWED_IMAGE_HOSTS may be fetched (Cloudinary in production), so the service
can't be used to reach other machines (SSRF). Size and pixel count are capped, and only JPEG, PNG
and WebP are decoded.
"""

import io
import ipaddress
import urllib.request
from urllib.parse import urlparse

from django.conf import settings
from PIL import Image, UnidentifiedImageError

MAX_BYTES = 5 * 1024 * 1024  # docs/02 §7.3
MAX_PIXELS = 40_000_000  # decompression-bomb guard
ALLOWED_FORMATS = {"JPEG", "PNG", "WEBP"}
TIMEOUT_S = 5


class ImageRejected(Exception):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def _check_url(url: str) -> None:
    parsed = urlparse(url)
    host = (parsed.hostname or "").lower()
    allowed = settings.AI_ALLOWED_IMAGE_HOSTS
    if host not in allowed:
        raise ImageRejected("HOST_NOT_ALLOWED", f"host {host!r} is not an allowed image host")
    # https everywhere except plain-http local development hosts.
    is_local = host == "localhost" or _is_loopback(host)
    if parsed.scheme != "https" and not (parsed.scheme == "http" and is_local):
        raise ImageRejected("INSECURE_URL", "image URL must use https")


def _is_loopback(host: str) -> bool:
    try:
        return ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def fetch_image(url: str) -> Image.Image:
    _check_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": "suraksha-setu-ai/1"})
    try:
        with urllib.request.urlopen(
            req, timeout=TIMEOUT_S
        ) as resp:  # noqa: S310 (host allow-listed)
            data = resp.read(MAX_BYTES + 1)
    except OSError as err:
        raise ImageRejected("FETCH_FAILED", f"couldn't download image: {err}") from err
    if len(data) > MAX_BYTES:
        raise ImageRejected("TOO_LARGE", "image is larger than 5 MB")
    return decode_image(data)


def decode_image(data: bytes) -> Image.Image:
    Image.MAX_IMAGE_PIXELS = MAX_PIXELS
    try:
        img = Image.open(io.BytesIO(data))
        if img.format not in ALLOWED_FORMATS:
            raise ImageRejected("BAD_FORMAT", f"unsupported image format {img.format}")
        img.load()
        return img
    except (UnidentifiedImageError, Image.DecompressionBombError, OSError) as err:
        raise ImageRejected("BAD_IMAGE", "not a readable image") from err
