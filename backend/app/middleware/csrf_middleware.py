"""CSRF enforcement for cookie-authenticated API requests."""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.auth_cookies import read_access_token, read_refresh_token
from app.core.config import get_settings
from app.core.csrf import (
    csrf_required_for_request,
    origin_guard_required,
    validate_csrf_request,
    validate_state_change_header,
    validate_trusted_origin,
)

logger = logging.getLogger("gns_insights.csrf")


def _forbid(code: str, detail: str) -> JSONResponse:
    logger.warning("csrf_forbidden code=%s detail=%s", code, detail)
    return JSONResponse(status_code=403, content={"detail": detail, "code": code})


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if origin_guard_required(request):
            has_cookie_session = bool(read_access_token(request) or read_refresh_token(request))
            origin = (request.headers.get("origin") or "").strip()
            if has_cookie_session and origin:
                if not validate_trusted_origin(request, settings):
                    return _forbid("CSRF_ORIGIN_MISMATCH", "Origin not allowed")
                if not validate_state_change_header(request):
                    return _forbid("CSRF_CLIENT_HEADER_MISSING", "Missing trusted client header")
        if csrf_required_for_request(request, settings):
            if not validate_trusted_origin(request, settings):
                return _forbid("CSRF_ORIGIN_MISMATCH", "Origin not allowed")
            if not validate_csrf_request(request, settings):
                return _forbid("CSRF_TOKEN_MISMATCH", "CSRF validation failed")
        return await call_next(request)
