"""In-memory upload rate limiting (per user / tenant)."""

from __future__ import annotations

import time
from collections import defaultdict, deque
from threading import Lock

from fastapi import HTTPException

from app.core.config import get_settings

_lock = Lock()
_user_uploads: dict[str, deque] = defaultdict(deque)
_tenant_bytes: dict[str, deque] = defaultdict(deque)
_concurrent_uploads: dict[str, int] = defaultdict(int)


def _prune(q: deque, window_seconds: int) -> None:
    cutoff = time.monotonic() - window_seconds
    while q and q[0][0] < cutoff:
        q.popleft()


def check_concurrent_upload_limit(tenant_id: int, user_id: int) -> None:
    settings = get_settings()
    key = f"{tenant_id}:{user_id}"
    with _lock:
        if _concurrent_uploads[key] >= settings.max_concurrent_uploads:
            raise HTTPException(
                status_code=429,
                detail="Too many concurrent uploads. Please wait for an upload to finish.",
            )
        _concurrent_uploads[key] += 1


def release_concurrent_upload(tenant_id: int, user_id: int) -> None:
    key = f"{tenant_id}:{user_id}"
    with _lock:
        if _concurrent_uploads[key] > 0:
            _concurrent_uploads[key] -= 1


def check_upload_rate_limits(tenant_id: int, user_id: int, file_size: int) -> None:
    settings = get_settings()
    window = settings.upload_rate_window_seconds
    max_uploads = settings.max_uploads_per_hour
    max_bytes = settings.max_upload_gb_per_hour * 1024 * 1024 * 1024

    user_key = f"{tenant_id}:{user_id}"
    tenant_key = str(tenant_id)
    now = time.monotonic()

    with _lock:
        uq = _user_uploads[user_key]
        tq = _tenant_bytes[tenant_key]
        _prune(uq, window)
        _prune(tq, window)

        if len(uq) >= max_uploads:
            raise HTTPException(
                status_code=429,
                detail="Upload rate limit exceeded. Please try again later.",
            )

        tenant_total = sum(size for _, size in tq)
        if tenant_total + file_size > max_bytes:
            raise HTTPException(
                status_code=429,
                detail="Company upload volume limit exceeded for this period.",
            )

        uq.append((now, file_size))
        tq.append((now, file_size))


def clear_rate_limits() -> None:
    """Test helper — reset in-memory rate limit buckets."""
    with _lock:
        _user_uploads.clear()
        _tenant_bytes.clear()
        _concurrent_uploads.clear()
