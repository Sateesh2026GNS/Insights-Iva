"""Storage provider factory."""

from functools import lru_cache

from app.core.config import get_settings
from app.services.storage.base import StorageProvider
from app.services.storage.local_provider import LocalStorageProvider
from app.services.storage.s3_provider import S3StorageProvider


@lru_cache
def get_storage_provider() -> StorageProvider:
    settings = get_settings()
    provider = (settings.storage_provider or "local").strip().lower()
    if provider == "s3":
        return S3StorageProvider()
    if provider == "gcs":
        raise NotImplementedError(
            "GCS provider is not yet implemented. Use STORAGE_PROVIDER=s3 or local for development."
        )
    return LocalStorageProvider()
