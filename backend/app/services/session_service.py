"""Active device sessions — one row per refresh token, tenant-scoped."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.security import RefreshToken
from app.models.user import User
from app.services.audit_log_service import AuditLogService
from app.services.security_service import _utcnow

CURRENT_LABEL = "This device"


def _as_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _status_for(row: RefreshToken, now: datetime) -> str:
    if row.revoked or row.revoked_at:
        return "revoked"
    expires = _as_utc(row.expires_at)
    if expires and now >= expires:
        return "expired"
    return "active"


def serialize_session(row: RefreshToken, *, current_sid: str | None) -> dict:
    now = _utcnow()
    status = _status_for(row, now)
    is_current = bool(current_sid and row.session_uuid == current_sid)
    return {
        "id": row.session_uuid,
        "device_name": row.device_name or "Unknown device",
        "browser": row.browser,
        "operating_system": row.operating_system,
        "device_type": row.device_type,
        "approximate_location": row.approximate_location,
        "login_at": _as_utc(row.created_at),
        "last_active_at": _as_utc(row.last_active_at or row.created_at),
        "status": status,
        "is_current": is_current,
        "current_label": CURRENT_LABEL if is_current else None,
    }


def list_user_sessions(db: Session, user: User, *, current_sid: str | None) -> dict:
    now = _utcnow()
    rows = list(
        db.scalars(
            select(RefreshToken)
            .where(
                RefreshToken.user_id == user.id,
                RefreshToken.session_uuid.is_not(None),
                or_(
                    RefreshToken.tenant_id == user.tenant_id,
                    RefreshToken.tenant_id.is_(None),
                ),
            )
            .order_by(RefreshToken.last_active_at.desc().nulls_last(), RefreshToken.id.desc())
        ).all()
    )
    active = [r for r in rows if _status_for(r, now) == "active"]
    current = next((r for r in active if current_sid and r.session_uuid == current_sid), None)
    others = [r for r in active if r is not current]
    return {
        "current": serialize_session(current, current_sid=current_sid) if current else None,
        "others": [serialize_session(r, current_sid=current_sid) for r in others],
        "total_active": len(active),
    }


def _owned_session(db: Session, user: User, session_uuid: str) -> RefreshToken:
    row = db.scalars(
        select(RefreshToken).where(
            RefreshToken.session_uuid == session_uuid,
            RefreshToken.user_id == user.id,
            or_(
                RefreshToken.tenant_id == user.tenant_id,
                RefreshToken.tenant_id.is_(None),
            ),
        )
    ).first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")
    return row


def _revoke_row(db: Session, row: RefreshToken) -> None:
    now = _utcnow()
    row.revoked = True
    row.revoked_at = row.revoked_at or now
    if row.last_jti:
        from app.models.security import RevokedToken
        from app.utils.security_tokens import hash_token

        existing = db.scalars(select(RevokedToken).where(RevokedToken.jti == row.last_jti)).first()
        if not existing:
            db.add(
                RevokedToken(
                    jti=row.last_jti,
                    token_hash=hash_token(f"jti:{row.last_jti}"),
                    user_id=row.user_id,
                    revoked_at=now,
                    expires_at=row.expires_at,
                )
            )


def revoke_user_session(
    db: Session,
    user: User,
    session_uuid: str,
    *,
    current_sid: str | None,
    request=None,
) -> dict:
    row = _owned_session(db, user, session_uuid)
    if row.revoked or row.revoked_at:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This session is already signed out.")
    _revoke_row(db, row)
    AuditLogService.log(
        db=db,
        request=request,
        current_user=user,
        action="session_revoke",
        module_name="auth",
        resource="session",
        details=f"Revoked device session {session_uuid[:8]}",
        session_id=session_uuid,
        commit=False,
    )
    db.commit()
    return {
        "revoked_id": session_uuid,
        "current_revoked": bool(current_sid and session_uuid == current_sid),
        "message": "Signed out of that device.",
    }


def revoke_all_user_sessions(
    db: Session,
    user: User,
    *,
    current_sid: str | None,
    request=None,
) -> dict:
    now = _utcnow()
    rows = list(
        db.scalars(
            select(RefreshToken).where(
                RefreshToken.user_id == user.id,
                or_(
                    RefreshToken.tenant_id == user.tenant_id,
                    RefreshToken.tenant_id.is_(None),
                ),
                RefreshToken.revoked.is_(False),
            )
        ).all()
    )
    count = 0
    for row in rows:
        if row.revoked_at:
            continue
        _revoke_row(db, row)
        count += 1
    user.tokens_revoked_at = now
    AuditLogService.log(
        db=db,
        request=request,
        current_user=user,
        action="session_revoke_all",
        module_name="auth",
        resource="session",
        details=f"Revoked {count} device session(s)",
        session_id=current_sid,
        commit=False,
    )
    db.commit()
    return {
        "revoked_count": count,
        "current_revoked": True,
        "message": "Signed out from all devices.",
    }


def bind_access_jti(db: Session, raw_refresh: str | None, access_token: str | None) -> None:
    if not raw_refresh or not access_token:
        return
    from app.services.auth_service import decode_access_token
    from app.services.security_service import get_refresh_token_row

    row = get_refresh_token_row(db, raw_refresh)
    payload = decode_access_token(access_token) or {}
    if row and payload.get("jti"):
        row.last_jti = payload["jti"]
        try:
            db.commit()
        except Exception:
            db.rollback()
