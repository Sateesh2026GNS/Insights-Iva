"""Rate limiting for auth, public, and authenticated API traffic."""

from __future__ import annotations

import math
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings

_lock = Lock()
_buckets: dict[str, list[float]] = defaultdict(list)
_failure_buckets: dict[str, list[float]] = defaultdict(list)

# Safe generic messages — never expose implementation details.
MSG_LOGIN = "Too many login attempts. Please try again later."
MSG_REGISTER = "Too many registration attempts. Please try again later."
MSG_FORGOT = "Too many password reset requests. Please try again later."
MSG_OTP = "Too many verification requests. Please try again later."
MSG_API_PUBLIC = "Too many requests. Please try again later."
MSG_API_AUTH = "Too many requests. Please slow down and try again."
MSG_UPLOAD = "Upload rate limit exceeded. Please try again later."


def clear_buckets() -> None:
    """Test helper — reset all in-memory rate limit state."""
    with _lock:
        _buckets.clear()
        _failure_buckets.clear()


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


def record_auth_failure(request: Request, email: str | None = None) -> None:
    """Track auth failures for progressive backoff (not a permanent lockout)."""
    settings = get_settings()
    window = settings.auth_backoff_window_seconds
    key = f"fail:{_client_key(request, email)}"
    now = time.time()
    with _lock:
        hits = [t for t in _failure_buckets[key] if now - t < window]
        hits.append(now)
        _failure_buckets[key] = hits


def _recent_failure_count(request: Request, email: str | None = None) -> int:
    settings = get_settings()
    window = settings.auth_backoff_window_seconds
    key = f"fail:{_client_key(request, email)}"
    now = time.time()
    with _lock:
        return len([t for t in _failure_buckets.get(key, []) if now - t < window])


def check_auth_backoff(request: Request, email: str | None = None) -> None:
    """
    Progressive backoff after repeated auth failures.
    Tightens allowed attempts without permanent account lockout.
    """
    settings = get_settings()
    failures = _recent_failure_count(request, email)
    if failures < settings.auth_backoff_threshold:
        return
    # Exponential reduction: more failures → stricter cap within the window
    exponent = min(failures - settings.auth_backoff_threshold, 5)
    reduced_limit = max(1, settings.login_rate_limit // (2 ** exponent))
    _enforce_bucket(
        f"backoff:{_client_key(request, email)}",
        max_requests=reduced_limit,
        window_seconds=settings.login_rate_window_seconds,
        detail=MSG_LOGIN,
    )


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
    scope_messages = {
        "login": MSG_LOGIN,
        "register": MSG_REGISTER,
        "forgot_password": MSG_FORGOT,
        "otp": MSG_OTP,
        "api_public": MSG_API_PUBLIC,
        "api_authenticated": MSG_API_AUTH,
        "upload": MSG_UPLOAD,
    }
    detail = scope_messages.get(scope, MSG_API_PUBLIC)

    if max_requests is None or window_seconds is None:
        if scope == "login":
            max_requests = settings.login_rate_limit
            window_seconds = settings.login_rate_window_seconds
        elif scope == "register":
            max_requests = settings.register_rate_limit
            window_seconds = settings.register_rate_window_seconds
        elif scope == "otp":
            max_requests = settings.otp_rate_limit
            window_seconds = settings.otp_rate_window_seconds
        elif scope == "api_public":
            max_requests = settings.api_public_rate_limit
            window_seconds = settings.api_public_rate_window_seconds
        elif scope == "api_authenticated":
            max_requests = settings.api_authenticated_rate_limit
            window_seconds = settings.api_authenticated_rate_window_seconds
        else:
            max_requests = settings.forgot_password_rate_limit
            window_seconds = settings.forgot_password_rate_window_seconds

    email_part = (email or "").lower().strip()

    if scope == "forgot_password" and email_part:
        _enforce_bucket(
            f"{scope}:email:{email_part}",
            max_requests=max_requests,
            window_seconds=window_seconds,
            detail=detail,
        )
        return

    if scope in ("login", "register", "otp"):
        ip = _client_ip(request)
        ip_limit = max(max_requests * 3, max_requests + 10)
        _enforce_bucket(
            f"{scope}:ip:{ip}",
            max_requests=ip_limit,
            window_seconds=window_seconds,
            detail=detail,
        )
        if email_part:
            _enforce_bucket(
                f"{scope}:{_client_key(request, email)}",
                max_requests=max_requests,
                window_seconds=window_seconds,
                detail=detail,
            )
        return

    if scope in ("api_public", "api_authenticated"):
        ip = _client_ip(request)
        _enforce_bucket(
            f"{scope}:ip:{ip}",
            max_requests=max_requests,
            window_seconds=window_seconds,
            detail=detail,
        )
        return

    _enforce_bucket(
        f"{scope}:{_client_key(request, email)}",
        max_requests=max_requests,
        window_seconds=window_seconds,
        detail=detail,
    )


_SKIP_PATH_PREFIXES = (
    "/health",
    "/docs",
    "/redoc",
    "/openapi.json",
)

_AUTH_PATH_FRAGMENTS = (
    "/auth/login",
    "/auth/register",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify",
    "/auth/refresh",
    "/platform/auth/",
)


class ApiRateLimitMiddleware(BaseHTTPMiddleware):
    """Global per-IP rate limiting for public and authenticated API traffic."""

    async def dispatch(self, request: Request, call_next) -> Response:
        path = request.url.path or ""
        if any(path.startswith(p) for p in _SKIP_PATH_PREFIXES):
            return await call_next(request)

        # Auth endpoints use stricter per-route limits in handlers.
        if any(frag in path for frag in _AUTH_PATH_FRAGMENTS):
            return await call_next(request)

        # File upload local dev endpoints — moderate public cap
        if "/files/local-upload" in path:
            try:
                check_rate_limit(request, scope="upload")
            except HTTPException as exc:
                return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
            return await call_next(request)

        has_bearer = bool(request.headers.get("Authorization", "").startswith("Bearer "))
        try:
            if has_bearer:
                check_rate_limit(request, scope="api_authenticated")
            elif path.startswith("/api/") or path.startswith("/sales/") or path.startswith("/auth/"):
                check_rate_limit(request, scope="api_public")
        except HTTPException as exc:
            return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})

        return await call_next(request)
