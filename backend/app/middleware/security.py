"""In-memory rate limiting for sensitive auth endpoints."""

from __future__ import annotations

import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_lock = Lock()
_buckets: dict[str, list[float]] = defaultdict(list)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def _client_key(request: Request, email: str | None = None) -> str:
    ip = _client_ip(request)
    email_part = (email or "").lower().strip()
    return f"{ip}:{email_part}"


def _enforce_bucket(
    key: str,
    *,
    max_requests: int,
    window_seconds: int,
    detail: str,
) -> None:
    now = time.time()
    with _lock:
        hits = [t for t in _buckets[key] if now - t < window_seconds]
        if len(hits) >= max_requests:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=detail,
            )
        hits.append(now)
        _buckets[key] = hits


def check_rate_limit(
    request: Request,
    *,
    email: str | None = None,
    scope: str = "forgot_password",
    max_requests: int | None = None,
    window_seconds: int | None = None,
) -> None:
    """Raise 429 when too many requests in the configured window."""
    settings = get_settings()
    if max_requests is None or window_seconds is None:
        if scope == "login":
            max_requests = getattr(settings, "login_rate_limit", 20)
            window_seconds = getattr(settings, "login_rate_window_seconds", 300)
        else:
            max_requests = settings.forgot_password_rate_limit
            window_seconds = settings.forgot_password_rate_window_seconds
    email_part = (email or "").lower().strip()
    login_detail = "Too many login attempts. Please try again later."
    forgot_detail = "Too many password reset requests. Please try again later."
    detail = login_detail if scope == "login" else forgot_detail

    if scope == "forgot_password" and email_part:
        _enforce_bucket(
            f"{scope}:email:{email_part}",
            max_requests=max_requests,
            window_seconds=window_seconds,
            detail=detail,
        )
        return

    if scope == "login":
        ip = _client_ip(request)
        ip_limit = max(max_requests * 3, max_requests + 10)
        _enforce_bucket(
            f"{scope}:ip:{ip}",
            max_requests=ip_limit,
            window_seconds=window_seconds,
            detail=login_detail,
        )
        if email_part:
            _enforce_bucket(
                f"{scope}:{_client_key(request, email)}",
                max_requests=max_requests,
                window_seconds=window_seconds,
                detail=login_detail,
            )
        return

    _enforce_bucket(
        f"{scope}:{_client_key(request, email)}",
        max_requests=max_requests,
        window_seconds=window_seconds,
        detail=detail,
    )
