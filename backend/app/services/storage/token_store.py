"""Short-lived presigned token store for local development storage."""

from __future__ import annotations

import time
from dataclasses import dataclass
from threading import Lock

_lock = Lock()
_upload_tokens: dict[str, tuple[str, float]] = {}
_download_tokens: dict[str, tuple[str, str, float, int, int, int]] = {}


@dataclass
class StoredToken:
    storage_key: str
    filename: str | None = None
    file_id: int | None = None


def register_upload_token(token: str, storage_key: str, expires_at: float) -> None:
    with _lock:
        _upload_tokens[token] = (storage_key, expires_at)


def resolve_upload_token(token: str) -> str | None:
    with _lock:
        entry = _upload_tokens.get(token)
        if not entry:
            return None
        storage_key, expires_at = entry
        if time.time() > expires_at:
            _upload_tokens.pop(token, None)
            return None
        return storage_key


def register_download_token(
    token: str,
    storage_key: str,
    filename: str,
    expires_at: float,
    *,
    tenant_id: int,
    user_id: int,
    file_id: int,
) -> None:
    with _lock:
        _download_tokens[token] = (
            storage_key,
            filename,
            expires_at,
            tenant_id,
            user_id,
            file_id,
        )


def resolve_download_token(token: str, user_id: int, tenant_id: int) -> StoredToken | None:
    with _lock:
        entry = _download_tokens.get(token)
        if not entry:
            return None
        storage_key, filename, expires_at, owner_tenant, owner_user, file_id = entry
        if time.time() > expires_at:
            _download_tokens.pop(token, None)
            return None
        if owner_user != user_id or owner_tenant != tenant_id:
            return None
        return StoredToken(storage_key=storage_key, filename=filename, file_id=file_id)


def clear_token_store() -> None:
    """Test helper — clear all tokens."""
    with _lock:
        _upload_tokens.clear()
        _download_tokens.clear()
