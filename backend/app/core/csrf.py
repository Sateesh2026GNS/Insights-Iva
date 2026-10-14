"""Double-submit CSRF protection for cookie-authenticated browser sessions."""

from __future__ import annotations

import hmac
import secrets
from hashlib import sha256

from fastapi import Request, Response

from app.core.auth_cookies import (
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    read_access_token,
    read_refresh_token,
)
from app.core.config import Settings, get_settings

CSRF_EXEMPT_PREFIXES = (
    "/auth/login",
    "/auth/register",
    "/auth/phone-login",
    "/auth/refresh",
    "/auth/logout",
    "/auth/forgot-password",
    "/auth/reset-password",
    "/auth/verify-email",
    "/auth/validate-reset-token",
    "/auth/csrf",
    "/api/auth/login",
    "/api/auth/register",
    "/platform/auth/login",
    "/api/auth/refresh",
    "/api/auth/logout",
    # Upload-token PUTs are authenticated by the token in the path, not the session.
    "/api/files/local-upload",
    "/api/files/local-upload-part",
    "/health",
    "/docs",
    "/openapi.json",
    "/redoc",
)


def _sign(token: str, settings: Settings) -> str:
    key = settings.jwt_secret_key.encode("utf-8")
    digest = hmac.new(key, token.encode("utf-8"), sha256).hexdigest()
    return f"{token}.{digest}"


def _unsign(signed: str, settings: Settings) -> str | None:
    if not signed or "." not in signed:
        return None
    token, digest = signed.rsplit(".", 1)
    expected = hmac.new(
        settings.jwt_secret_key.encode("utf-8"),
        token.encode("utf-8"),
        sha256,
    ).hexdigest()
    if not hmac.compare_digest(digest, expected):
        return None
    return token


def generate_csrf_token(settings: Settings | None = None) -> str:
    settings = settings or get_settings()
    raw = secrets.token_urlsafe(32)
    return _sign(raw, settings)


def set_csrf_cookie(
    response: Response,
    request: Request,
    *,
    settings: Settings | None = None,
) -> str:
    settings = settings or get_settings()
    token = generate_csrf_token(settings)
    secure = settings.is_production or (
        (request.headers.get("x-forwarded-proto") or request.url.scheme or "").lower() == "https"
    )
    samesite = (settings.auth_cookie_samesite or "lax").strip().lower()
    domain = (settings.auth_cookie_domain or "").strip() or None
    response.set_cookie(
        key=CSRF_COOKIE_NAME,
        value=token,
        max_age=86400,
        httponly=False,
        secure=secure,
        samesite=samesite,
        path="/",
        domain=domain,
    )
    return token


def is_csrf_exempt_path(path: str) -> bool:
    p = (path or "").rstrip("/") or "/"
    for prefix in CSRF_EXEMPT_PREFIXES:
        if p == prefix.rstrip("/") or p.startswith(prefix):
            return True
    return False


def validate_csrf_request(request: Request, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    cookie_val = request.cookies.get(CSRF_COOKIE_NAME) or ""
    header_val = request.headers.get(CSRF_HEADER_NAME) or ""
    if not cookie_val or not header_val:
        return False
    if not hmac.compare_digest(cookie_val, header_val):
        return False
    return _unsign(cookie_val, settings) is not None


def validate_trusted_origin(request: Request, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    origin = (request.headers.get("origin") or "").strip()
    if not origin:
        referer = (request.headers.get("referer") or "").strip()
        if referer:
            from urllib.parse import urlparse

            parsed = urlparse(referer)
            if parsed.scheme and parsed.netloc:
                origin = f"{parsed.scheme}://{parsed.netloc}"
    if not origin:
        return True
    if origin in settings.cors_origin_list:
        return True
    return settings.cors_origin_allowed_by_regex(origin)


ORIGIN_GUARD_PREFIXES = (
    "/auth/refresh",
    "/auth/logout",
    "/api/auth/refresh",
    "/api/auth/logout",
)

STATE_CHANGE_HEADER = "X-Requested-With"
STATE_CHANGE_HEADER_VALUE = "InsightsIva"


def origin_guard_required(request: Request) -> bool:
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return False
    p = (request.url.path or "").rstrip("/") or "/"
    for prefix in ORIGIN_GUARD_PREFIXES:
        if p == prefix.rstrip("/") or p.startswith(prefix):
            return True
    return False


def validate_state_change_header(request: Request) -> bool:
    val = (request.headers.get(STATE_CHANGE_HEADER) or "").strip()
    return val == STATE_CHANGE_HEADER_VALUE


def csrf_required_for_request(request: Request, settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    mode = (settings.auth_cookie_mode or "off").strip().lower()
    if mode == "off":
        return False
    if request.method in ("GET", "HEAD", "OPTIONS"):
        return False
    if is_csrf_exempt_path(request.url.path):
        return False
    auth_header = (request.headers.get("Authorization") or "").strip()
    if auth_header.lower().startswith("bearer "):
        return False
    if not read_access_token(request) and not read_refresh_token(request):
        return False
    return True
