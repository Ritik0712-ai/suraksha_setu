import pytest

from core.classifier import reset_classifier


@pytest.fixture(autouse=True)
def _fresh_classifier():
    """Each test loads the model its own MODEL_PATH points at."""
    reset_classifier()
    yield
    reset_classifier()
