from django.urls import include, path

urlpatterns = [
    path("internal/", include("core.urls")),
]
