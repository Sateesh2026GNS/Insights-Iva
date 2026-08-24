"""Login audit trail — success, failure, and logout updates."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.permissions import user_is_admin
from app.models.security import LoginHistory
from app.models.user import User
from app.utils.user_agent import parse_user_agent

logger = logging.getLogger("gns_insights.login_history")

STATUS_SUCCESS = "Success"
STATUS_FAILED = "Failed"


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_utc(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _format_row(row: LoginHistory) -> dict:
    login_at = row.login_at
    if login_at and login_at.tzinfo is None:
        login_at = login_at.replace(tzinfo=timezone.utc)
    logout_at = row.logout_at
    if logout_at and logout_at.tzinfo is None:
        logout_at = logout_at.replace(tzinfo=timezone.utc)

    return {
        "id": row.id,
        "user_id": row.user_id,
        "company_id": row.company_id,
        "full_name": row.full_name,
        "company_name": row.company_name,
        "email": row.email,
        "role": row.role,
        "ip_address": row.ip_address,
        "browser": row.browser,
        "operating_system": row.operating_system,
        "device_type": row.device_type,
        "login_status": row.login_status,
        "login_at": login_at,
        "logout_at": logout_at,
        "created_at": row.created_at,
        "login_date": login_at.strftime("%Y-%m-%d") if login_at else None,
        "login_time": login_at.strftime("%H:%M:%S") if login_at else None,
        "logout_time": logout_at.strftime("%H:%M:%S") if logout_at else None,
    }


def record_login_history(
    db: Session,
    *,
    email: str,
    success: bool,
    user: User | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    role: str | None = None,
) -> LoginHistory:
    """Insert a login_history row for success or failure."""
    try:
        parsed = parse_user_agent(user_agent)
        company_id = None
        company_name = None
        full_name = None
        user_id = None
        resolved_role = role

        if user is not None:
            user_id = user.id
            full_name = user.full_name
            company_id = user.tenant_id
            if getattr(user, "tenant", None) is not None:
                company_name = user.tenant.name
            elif company_id:
                try:
                    from app.models.tenant import Tenant
                    t = db.get(Tenant, company_id)
                    company_name = t.name if t else None
                except Exception:
                    company_name = None
            if not resolved_role:
                resolved_role = user.roles[0].name if user.roles else None

        row = LoginHistory(
            user_id=user_id,
            company_id=company_id,
            full_name=full_name,
            company_name=company_name,
            email=(email or "").lower().strip(),
            role=resolved_role,
            ip_address=ip_address,
            browser=parsed["browser"],
            operating_system=parsed["operating_system"],
            device_type=parsed["device_type"],
            login_status=STATUS_SUCCESS if success else STATUS_FAILED,
            login_at=_utcnow(),
            logout_at=None,
            user_agent=(user_agent or "")[:512] or None,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        logger.info(
            "login_history_recorded status=%s email=%s user_id=%s company_id=%s",
            row.login_status,
            row.email,
            row.user_id,
            row.company_id,
        )
        return row
    except SQLAlchemyError as exc:
        logger.exception("record_login_history database error for email %s: %s", email, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except Exception as exc:
        logger.exception("record_login_history unexpected error for email %s: %s", email, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise


def mark_logout(
    db: Session,
    *,
    user_id: int | None = None,
    email: str | None = None,
    ip_address: str | None = None,
    user_agent: str | None = None,
    history_id: int | None = None,
    all_sessions: bool = False,
) -> LoginHistory | None:
    """Set logout_at on the specific open successful session matching user, device/IP, or history_id."""
    try:
        if history_id is not None:
            stmt = select(LoginHistory).where(
                LoginHistory.id == history_id,
                LoginHistory.login_status == STATUS_SUCCESS,
                LoginHistory.logout_at.is_(None),
            )
            row = db.scalars(stmt).first()
            if row:
                now = _utcnow()
                if row.login_at and now < row.login_at:
                    raise ValueError("logout_at timestamp cannot be earlier than login_at timestamp.")
                row.logout_at = now
                db.commit()
                db.refresh(row)
                return row
            return None

        base_stmt = (
            select(LoginHistory)
            .where(
                LoginHistory.login_status == STATUS_SUCCESS,
                LoginHistory.logout_at.is_(None),
            )
            .order_by(LoginHistory.login_at.desc())
        )
        if user_id is not None:
            base_stmt = base_stmt.where(LoginHistory.user_id == user_id)
        elif email:
            base_stmt = base_stmt.where(LoginHistory.email == email.lower().strip())
        else:
            return None

        has_device_info = bool(ip_address or user_agent)
        matched_rows: list[LoginHistory] = []

        if ip_address and user_agent:
            ua_clean = (user_agent or "")[:512]
            exact_stmt = base_stmt.where(
                LoginHistory.ip_address == ip_address,
                LoginHistory.user_agent == ua_clean,
            )
            matched_rows = list(db.scalars(exact_stmt).all())

        if not matched_rows and user_agent:
            ua_clean = (user_agent or "")[:512]
            ua_stmt = base_stmt.where(LoginHistory.user_agent == ua_clean)
            matched_rows = list(db.scalars(ua_stmt).all())

        if not matched_rows and ip_address:
            ip_stmt = base_stmt.where(LoginHistory.ip_address == ip_address)
            matched_rows = list(db.scalars(ip_stmt).all())

        if not matched_rows and not has_device_info:
            all_open = list(db.scalars(base_stmt).all())
            if len(all_open) > 1 and not all_sessions:
                raise ValueError(
                    "Multiple active sessions exist for user; specify history_id, ip_address, or user_agent to identify the session to log out."
                )
            matched_rows = all_open

        if not matched_rows:
            return None

        now = _utcnow()
        if all_sessions:
            for r in matched_rows:
                login_at = _ensure_utc(r.login_at)
                if login_at and now < login_at:
                    raise ValueError("logout_at timestamp cannot be earlier than login_at timestamp.")
                r.logout_at = now
            db.commit()
            db.refresh(matched_rows[0])
            return matched_rows[0]

        target = matched_rows[0]
        login_at = _ensure_utc(target.login_at)
        if login_at and now < login_at:
            raise ValueError("logout_at timestamp cannot be earlier than login_at timestamp.")
        target.logout_at = now
        db.commit()
        db.refresh(target)
        logger.info("login_history_logout id=%s user_id=%s", target.id, target.user_id)
        return target
    except ValueError:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("mark_logout database error for user_id=%s email=%s: %s", user_id, email, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except Exception as exc:
        logger.exception("mark_logout unexpected error for user_id=%s email=%s: %s", user_id, email, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise


def list_for_user(db: Session, user_id: int, *, limit: int = 200) -> list[dict]:
    rows = db.scalars(
        select(LoginHistory)
        .where(LoginHistory.user_id == user_id)
        .order_by(LoginHistory.login_at.desc())
        .limit(limit)
    ).all()
    return [_format_row(r) for r in rows]


def list_for_company(db: Session, company_id: int, *, limit: int = 500) -> list[dict]:
    rows = db.scalars(
        select(LoginHistory)
        .where(LoginHistory.company_id == company_id)
        .order_by(LoginHistory.login_at.desc())
        .limit(limit)
    ).all()
    return [_format_row(r) for r in rows]


def list_visible(db: Session, current_user: User, *, limit: int = 500) -> list[dict]:
    """Admins see company history; others see only their own."""
    if user_is_admin(current_user):
        return list_for_company(db, current_user.tenant_id, limit=limit)
    return list_for_user(db, current_user.id, limit=limit)


def delete_history(db: Session, *, history_id: int, admin: User) -> None:
    if not user_is_admin(admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required.",
        )
    try:
        row = db.get(LoginHistory, history_id)
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Login history not found.")
        if row.company_id != admin.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot delete login history outside your company.",
            )
        db.delete(row)
        db.commit()
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("delete_history database error for history_id=%s: %s", history_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting login history.",
        ) from exc
    except Exception as exc:
        logger.exception("delete_history unexpected error for history_id=%s: %s", history_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise
