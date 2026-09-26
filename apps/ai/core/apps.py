from django.apps import AppConfig


class CoreConfig(AppConfig):
    name = "core"

    def ready(self):
        # Fail fast at startup if the shared enum file is missing or malformed.
        from .constants import get_constants

        get_constants()
