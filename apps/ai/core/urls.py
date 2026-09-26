from django.urls import path

from . import views

urlpatterns = [
    path("health", views.health, name="internal-health"),
    path("classify", views.classify, name="internal-classify"),
    path("sahayak/reply", views.sahayak_reply, name="internal-sahayak-reply"),
]
