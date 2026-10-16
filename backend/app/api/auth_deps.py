"""JWT auth dependencies for protected routes."""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.api.deps import get_db
from app.core.auth_cookies import cookie_auth_enabled, read_access_token
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.services.security_service import (
    check_session_active,
    is_access_token_revoked,
    is_refresh_session_revoked,
    touch_refresh_session,
    touch_user_activity,
)

http_bearer = HTTPBearer(auto_error=False)


def resolve_access_token(
    request: Request,
    creds: HTTPAuthorizationCredentials | None,
) -> str | None:
    if creds and creds.credentials:
        return creds.credentials.strip()
    if cookie_auth_enabled():
        return read_access_token(request)
    return None


def get_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User:
    token = resolve_access_token(request, creds)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        )
    if is_access_token_revoked(db, token, payload):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    try:
        user_id = int(sub)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    user = db.scalars(
        select(User).where(User.id == user_id).options(selectinload(User.roles))
    ).first()
    if not user or not user.is_active or not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    if not check_session_active(user):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session expired due to inactivity",
        )
    session_id = payload.get("sid")
    if session_id and is_refresh_session_revoked(
        db, session_uuid=str(session_id), user_id=user.id, tenant_id=user.tenant_id
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
        )
    user.active_role = payload.get("role_name") or payload.get("role")
    touch_user_activity(db, user)
    if session_id:
        touch_refresh_session(db, str(session_id))
    request.state.session_id = session_id
    return user


def get_optional_current_user(
    request: Request,
    creds: HTTPAuthorizationCredentials | None = Depends(http_bearer),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the authenticated user if valid credentials present; otherwise None without raising 401."""
    try:
        token = resolve_access_token(request, creds)
        if not token:
            return None
        payload = decode_access_token(token)
        if not payload:
            return None
        if is_access_token_revoked(db, token, payload):
            return None
        sub = payload.get("sub")
        if sub is None:
            return None
        try:
            user_id = int(sub)
        except (TypeError, ValueError):
            return None
        user = db.scalars(
            select(User).where(User.id == user_id).options(selectinload(User.roles))
        ).first()
        if not user or not user.is_active or not user.email_verified:
            return None
        if not check_session_active(user):
            return None
        session_id = payload.get("sid")
        if session_id and is_refresh_session_revoked(
            db, session_uuid=str(session_id), user_id=user.id, tenant_id=user.tenant_id
        ):
            return None
        user.active_role = payload.get("role_name") or payload.get("role")
        return user
    except Exception:
        return None
