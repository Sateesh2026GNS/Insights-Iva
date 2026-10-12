"""CSRF enforcement for cookie-authenticated API requests."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import get_settings
from app.core.csrf import (
    csrf_required_for_request,
    validate_csrf_request,
    validate_trusted_origin,
)


class CsrfMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        if csrf_required_for_request(request, settings):
            if not validate_trusted_origin(request, settings):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Origin not allowed"},
                )
            if not validate_csrf_request(request, settings):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "CSRF validation failed"},
                )
        return await call_next(request)
