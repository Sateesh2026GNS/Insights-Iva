"""HttpOnly session cookies for browser authentication."""

from __future__ import annotations

from fastapi import Request, Response

from app.core.config import Settings, get_settings

ACCESS_COOKIE_NAME = "iva_at"
REFRESH_COOKIE_NAME = "iva_rt"
CSRF_COOKIE_NAME = "iva_csrf"
CSRF_HEADER_NAME = "X-CSRF-Token"


def _cookie_secure(request: Request, settings: Settings) -> bool:
    if settings.auth_cookie_secure is not None:
        return bool(settings.auth_cookie_secure)
    if settings.is_production:
        return True
    proto = (request.headers.get("x-forwarded-proto") or request.url.scheme or "").lower()
    return proto == "https"


def _same_site(settings: Settings) -> str:
    return (settings.auth_cookie_samesite or "lax").strip().lower()


def set_auth_cookies(
    response: Response,
    request: Request,
    *,
    access_token: str,
    refresh_token: str,
    settings: Settings | None = None,
) -> None:
    settings = settings or get_settings()
    secure = _cookie_secure(request, settings)
    samesite = _same_site(settings)
    domain = (settings.auth_cookie_domain or "").strip() or None
    access_max = max(60, int(settings.access_token_expire_minutes) * 60)
    refresh_max = max(3600, int(settings.refresh_token_expire_days) * 86400)

    response.set_cookie(
        key=ACCESS_COOKIE_NAME,
        value=access_token,
        max_age=access_max,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/",
        domain=domain,
    )
    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        max_age=refresh_max,
        httponly=True,
        secure=secure,
        samesite=samesite,
        path="/auth",
        domain=domain,
    )


def clear_auth_cookies(response: Response, request: Request, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    domain = (settings.auth_cookie_domain or "").strip() or None
    for name, path in (
        (ACCESS_COOKIE_NAME, "/"),
        (REFRESH_COOKIE_NAME, "/auth"),
        (CSRF_COOKIE_NAME, "/"),
    ):
        response.delete_cookie(key=name, path=path, domain=domain)


def read_access_token(request: Request) -> str | None:
    raw = request.cookies.get(ACCESS_COOKIE_NAME)
    return raw.strip() if raw else None


def read_refresh_token(request: Request) -> str | None:
    raw = request.cookies.get(REFRESH_COOKIE_NAME)
    return raw.strip() if raw else None


def cookie_auth_enabled(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    mode = (settings.auth_cookie_mode or "off").strip().lower()
    return mode in ("dual", "cookie")


def tokens_in_json_response(settings: Settings | None = None) -> bool:
    settings = settings or get_settings()
    mode = (settings.auth_cookie_mode or "off").strip().lower()
    return mode in ("off", "dual")


def resolve_refresh_token(
    request: Request,
    body_token: str | None,
    settings: Settings | None = None,
) -> str | None:
    settings = settings or get_settings()
    mode = (settings.auth_cookie_mode or "off").strip().lower()
    cookie = read_refresh_token(request)
    if mode == "off":
        return body_token
    if mode == "cookie":
        return cookie
    return cookie or body_token


def apply_auth_response_cookies(
    response: Response,
    request: Request,
    data: dict,
    *,
    settings: Settings | None = None,
) -> dict:
    """Set cookies when enabled; strip tokens from JSON body in cookie-only mode."""
    from app.core.csrf import set_csrf_cookie

    settings = settings or get_settings()
    if not cookie_auth_enabled(settings):
        return data

    access = data.get("access_token") or ""
    refresh = data.get("refresh_token") or ""
    if access and refresh:
        set_auth_cookies(
            response,
            request,
            access_token=access,
            refresh_token=refresh,
            settings=settings,
        )
        csrf_token = set_csrf_cookie(response, request, settings=settings)
    else:
        csrf_token = None

    if not tokens_in_json_response(settings):
        out = {
            **data,
            "access_token": None,
            "refresh_token": None,
        }
        if csrf_token:
            out["csrf_token"] = csrf_token
        return out
    return data
