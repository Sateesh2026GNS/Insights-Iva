"""Reject shop-floor Operator calls that are not on the shared API allowlist."""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.database import SessionLocal
from app.core.operator_allowlist import operator_api_allowed
from app.services.auth_service import decode_access_token


def _bearer_token(request: Request) -> str | None:
    header = request.headers.get("authorization") or ""
    if header.lower().startswith("bearer "):
        token = header[7:].strip()
        return token or None
    return None


class OperatorAllowlistMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.method in {"OPTIONS", "HEAD"}:
            return await call_next(request)
        token = _bearer_token(request)
        if not token or operator_api_allowed(request.method, request.url.path):
            return await call_next(request)
        payload = decode_access_token(token)
        if not payload or payload.get("sub") is None:
            return await call_next(request)
        db = SessionLocal()
        try:
            from sqlalchemy import select
            from sqlalchemy.orm import selectinload

            from app.models.user import User
            from app.services.operator_scope import is_shop_floor_operator

            try:
                user_id = int(payload["sub"])
            except (TypeError, ValueError):
                return await call_next(request)
            user = db.scalars(
                select(User).where(User.id == user_id).options(selectinload(User.roles))
            ).first()
            if user and is_shop_floor_operator(user):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Operators cannot access this resource"},
                )
        finally:
            db.close()
        return await call_next(request)
