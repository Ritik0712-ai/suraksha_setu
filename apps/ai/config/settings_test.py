"""Test settings: debug mode so no real secret is needed."""

import os

os.environ.setdefault("DJANGO_DEBUG", "true")

from .settings import *  # noqa: E402,F403
