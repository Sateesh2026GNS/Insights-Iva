"""Tenant-prefixed object storage helpers with legacy local path resolution."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from app.core.config import get_settings
from app.services.storage.factory import get_storage_provider
from app.services.storage.local_provider import LocalStorageProvider

TENANT_KEY_PREFIX = "companies/"
FILE_UNAVAILABLE_MESSAGE = "This file is no longer available"


def is_modern_storage_key(stored: str) -> bool:
    return (stored or "").startswith(TENANT_KEY_PREFIX)


def build_tenant_storage_key(tenant_id: int, *segments: str) -> str:
    parts = [TENANT_KEY_PREFIX.rstrip("/"), str(tenant_id)]
    for seg in segments:
        s = (seg or "").strip().replace("..", "").strip("/\\")
        if s:
            parts.append(s)
    return "/".join(parts)


def put_bytes(storage_key: str, data: bytes, content_type: str = "application/octet-stream") -> None:
    provider = get_storage_provider()
    provider.put_object(storage_key, data, content_type)


def _legacy_lead_path(stored: str) -> Path | None:
    if not stored.startswith("leads/"):
        return None
    parts = stored.split("/")
    if len(parts) < 4:
        return None
    lead_root = Path(__file__).resolve().parents[2] / "uploads" / "leads"
    return lead_root / parts[1] / parts[2] / "/".join(parts[3:])


def delete_storage_object(storage_key: str) -> None:
    if is_modern_storage_key(storage_key):
        get_storage_provider().delete_object(storage_key)
        return
    lead_path = _legacy_lead_path(storage_key)
    if lead_path and lead_path.is_file():
        lead_path.unlink()
        return
    path = _legacy_local_path(storage_key)
    if path.is_file():
        path.unlink()


def blob_exists(stored: str) -> bool:
    """True if the blob exists in storage or legacy disk."""
    if is_modern_storage_key(stored):
        return get_storage_provider().head_object(stored) is not None
    lead_path = _legacy_lead_path(stored)
    if lead_path and lead_path.is_file():
        return True
    path = _legacy_local_path(stored)
    return path.is_file()


def get_bytes(stored: str) -> bytes:
    if is_modern_storage_key(stored):
        provider = get_storage_provider()
        if provider.head_object(stored) is None:
            raise HTTPException(status_code=404, detail=FILE_UNAVAILABLE_MESSAGE)
        try:
            return provider.get_object_bytes(stored)
        except Exception:
            raise HTTPException(status_code=404, detail=FILE_UNAVAILABLE_MESSAGE)
    lead_path = _legacy_lead_path(stored)
    if lead_path and lead_path.is_file():
        return lead_path.read_bytes()
    path = _legacy_local_path(stored)
    if not path.is_file():
        raise HTTPException(status_code=404, detail=FILE_UNAVAILABLE_MESSAGE)
    return path.read_bytes()


def _legacy_local_path(relative: str) -> Path:
    settings = get_settings()
    root = Path(settings.file_storage_local_path).resolve()
    path = (root / relative).resolve()
    if not str(path).startswith(str(root)):
        raise HTTPException(status_code=400, detail="Invalid file path")
    return path


def assert_tenant_owns_key(storage_key: str, tenant_id: int) -> None:
    if not is_modern_storage_key(storage_key):
        return
    prefix = f"{TENANT_KEY_PREFIX}{tenant_id}/"
    if not storage_key.startswith(prefix):
        raise HTTPException(status_code=403, detail="You do not have access to this file.")
