"""Reusable enterprise AuditLogService — always fills access_logs enriched columns."""

from __future__ import annotations

import csv
import io
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException, Request
from sqlalchemy import and_, func, insert, or_, select, update
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import user_is_admin
from app.models.security import AccessLog, AuditLog
from app.models.tenant import Tenant
from app.models.user import User
from app.services.auth_service import decode_access_token
from app.utils.user_agent import parse_user_agent

logger = logging.getLogger("gns_insights.audit")

MODULE_MAP = {
    "auth": "Authentication",
    "login": "Authentication",
    "logout": "Authentication",
    "password": "Settings",
    "profile": "Settings",
    "users": "Settings",
    "roles": "Settings",
    "settings": "Settings",
    "company": "Settings",
    "subscription": "Settings",
    "dashboard": "Dashboard",
    "products": "Masters",
    "bom": "Masters",
    "masters": "Masters",
    "inventory": "Inventory",
    "warehouse": "Inventory",
    "stock": "Inventory",
    "production": "Production",
    "work-orders": "Production",
    "work_orders": "Production",
    "planning": "Production",
    "machines": "Production",
    "quality": "Quality",
    "maintenance": "Maintenance",
    "hr": "HR",
    "employees": "HR",
    "accounts": "Finance",
    "finance": "Finance",
    "sales": "Sales",
    "procurement": "Purchase",
    "purchase": "Purchase",
    "analytics": "Analytics",
    "reports": "Analytics",
    "export": "Analytics",
}


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _client_ip(request: Request | None) -> str | None:
    if not request:
        return None
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None


def resolve_module(action: str | None, resource: str | None, path: str | None = None) -> str:
    hay = " ".join(filter(None, [action, resource, path])).lower()
    for key, module in MODULE_MAP.items():
        if key in hay:
            return module
    if path:
        parts = [p for p in path.strip("/").split("/") if p and p not in ("api", "erp")]
        if parts:
            return MODULE_MAP.get(parts[0].lower(), parts[0].replace("-", " ").title())
    return "System"


class AuditLogService:
    """Single entry-point for writing fully-populated access_logs rows."""

    @staticmethod
    def _load_user(db: Session, user_id: int | None) -> User | None:
        if not user_id:
            return None
        return db.scalars(
            select(User)
            .where(User.id == int(user_id))
            .options(selectinload(User.roles), selectinload(User.tenant))
        ).first()

    @staticmethod
    def _context_from_jwt(request: Request | None) -> dict[str, Any]:
        if not request:
            return {}
        auth = request.headers.get("Authorization") or ""
        if not auth.lower().startswith("bearer "):
            return {}
        payload = decode_access_token(auth.split(" ", 1)[1].strip()) or {}
        if payload.get("token_type") == "platform_admin":
            return {}
        return {
            "user_id": payload.get("user_id") or payload.get("sub"),
            "email": payload.get("email"),
            "company_id": payload.get("company_id") or payload.get("tenant_id"),
            "company_name": payload.get("company_name"),
            "role": payload.get("role_name") or payload.get("role"),
            "full_name": payload.get("full_name"),
        }

    @classmethod
    def _resolve_actor(
        cls,
        db: Session,
        *,
        request: Request | None,
        current_user: User | None,
    ) -> dict[str, Any]:
        """Merge JWT claims + ORM user so fields are never left blank when known."""
        jwt_ctx = cls._context_from_jwt(request)
        user = current_user
        if user is None and jwt_ctx.get("user_id") is not None:
            try:
                user = cls._load_user(db, int(jwt_ctx["user_id"]))
            except (TypeError, ValueError):
                user = None

        company_id = None
        company_name = None
        full_name = None
        email = None
        role = None
        user_id = None
        tenant_id = None

        if user is not None:
            user_id = user.id
            full_name = user.full_name
            email = user.email
            tenant_id = user.tenant_id
            company_id = user.tenant_id
            if user.roles:
                role = user.roles[0].name
            tenant = getattr(user, "tenant", None)
            if tenant is None:
                try:
                    db.refresh(user, ["tenant", "roles"])
                    tenant = user.tenant
                    if user.roles and not role:
                        role = user.roles[0].name
                except Exception:
                    tenant = db.get(Tenant, user.tenant_id)
            if tenant is not None:
                company_name = tenant.name
                company_id = tenant.id
                tenant_id = tenant.id

        # Fill gaps from JWT (never overwrite real DB values with empty)
        if full_name is None and jwt_ctx.get("full_name"):
            full_name = str(jwt_ctx["full_name"])
        if email is None and jwt_ctx.get("email"):
            email = str(jwt_ctx["email"])
        if role is None and jwt_ctx.get("role"):
            role = str(jwt_ctx["role"])
        if company_id is None and jwt_ctx.get("company_id") is not None:
            try:
                company_id = int(jwt_ctx["company_id"])
                tenant_id = tenant_id or company_id
            except (TypeError, ValueError):
                pass
        if company_name is None and jwt_ctx.get("company_name"):
            company_name = str(jwt_ctx["company_name"])
        if company_name is None and company_id is not None:
            tenant = db.get(Tenant, company_id)
            if tenant:
                company_name = tenant.name

        return {
            "user": user,
            "user_id": user_id,
            "full_name": full_name,
            "email": (email or "").lower().strip() or None,
            "role": role,
            "company_id": company_id,
            "company_name": company_name,
            "tenant_id": tenant_id or company_id,
        }

    @classmethod
    def log(
        cls,
        *,
        db: Session,
        request: Request | None = None,
        current_user: User | None = None,
        action: str,
        module_name: str | None = None,
        details: str | None = None,
        resource: str | None = None,
        resource_id: int | None = None,
        login_status: str | None = None,
        session_id: str | None = None,
        login_at: datetime | None = None,
        logout_at: datetime | None = None,
        email_override: str | None = None,
        role_override: str | None = None,
        commit: bool = True,
    ) -> AccessLog | None:
        """
        Insert one access_logs row with every enriched column populated when available.
        """
        try:
            actor = cls._resolve_actor(db, request=request, current_user=current_user)
            tenant_id = actor["tenant_id"]
            if tenant_id is None:
                fallback = db.scalars(select(Tenant).limit(1)).first()
                if not fallback:
                    logger.warning("audit_skip_no_tenant action=%s", action)
                    return None
                tenant_id = fallback.id

            ua = request.headers.get("User-Agent") if request else None
            ip = _client_ip(request)
            parsed = parse_user_agent(ua)
            now = _utcnow()
            module = module_name or resolve_module(action, resource)
            email = email_override or actor["email"]

            # Prefer explicit session id; generate on login/login_failed attempt; else reuse open session or generate tracking ID
            sid = session_id
            if sid is None and request and hasattr(request, "state") and getattr(request.state, "session_id", None):
                sid = getattr(request.state, "session_id")
            if sid is None and (action in ("login", "login_failed") or login_status in ("Failed", "Success")):
                sid = str(uuid.uuid4())
            elif sid is None and actor["user_id"] is not None:
                open_login = db.scalars(
                    select(AccessLog)
                    .where(
                        AccessLog.user_id == int(actor["user_id"]),
                        AccessLog.action == "login",
                        AccessLog.login_status == "Success",
                        AccessLog.logout_at.is_(None),
                        AccessLog.session_id.is_not(None),
                    )
                    .order_by(AccessLog.logged_at.desc())
                ).first()
                if open_login:
                    sid = open_login.session_id

            if sid is None:
                sid = str(uuid.uuid4())

            values = {
                "tenant_id": int(tenant_id),
                "company_id": int(actor["company_id"]) if actor["company_id"] is not None else int(tenant_id),
                "company_name": actor["company_name"],
                "user_id": actor["user_id"],
                "full_name": actor["full_name"],
                "email": (email or "").lower().strip() or None,
                "role": role_override or actor["role"],
                "action": action,
                "module_name": module,
                "resource": resource,
                "resource_id": resource_id,
                "login_status": login_status,
                "ip_address": ip,
                "browser": parsed["browser"],
                "operating_system": parsed["operating_system"],
                "device_type": parsed["device_type"],
                "session_id": sid,
                "user_agent": (ua or "")[:512] or None,
                "login_at": login_at,
                "logout_at": logout_at,
                "logged_at": now,
                "details": details,
            }

            # Force SQL INSERT with all columns (avoids ORM metadata drift issues)
            result = db.execute(insert(AccessLog).values(**values))
            new_id = result.inserted_primary_key[0] if result.inserted_primary_key else None

            # Backward-compatible mirror into audit_logs (legacy table)
            try:
                db.add(
                    AuditLog(
                        tenant_id=int(tenant_id),
                        user_id=actor["user_id"],
                        action=(action or "")[:32],
                        resource=(resource or module or "system")[:128],
                        resource_id=resource_id,
                        details=details,
                        ip_address=ip,
                    )
                )
            except Exception:
                logger.exception("legacy_audit_mirror_failed")

            if commit:
                db.commit()
            else:
                db.flush()

            row = db.get(AccessLog, new_id) if new_id else None
            logger.info(
                "audit_written id=%s action=%s module=%s company_id=%s user_id=%s "
                "email=%s role=%s browser=%s status=%s session_id=%s",
                new_id,
                action,
                module,
                values["company_id"],
                values["user_id"],
                values["email"],
                values["role"],
                values["browser"],
                login_status,
                sid,
            )
            return row
        except SQLAlchemyError as exc:
            logger.exception("AuditLogService.log database error: %s", exc)
            db.rollback()
            raise
        except Exception as exc:
            logger.exception("AuditLogService.log unexpected error: %s", exc)
            db.rollback()
            raise

    @classmethod
    def log_login_success(
        cls,
        db: Session,
        *,
        request: Request,
        user: User,
        role: str | None = None,
        commit: bool = True,
    ) -> AccessLog | None:
        now = _utcnow()
        # Close any prior open active login sessions for this user before starting new session
        try:
            db.execute(
                update(AccessLog)
                .where(
                    AccessLog.user_id == user.id,
                    AccessLog.action == "login",
                    AccessLog.login_status == "Success",
                    AccessLog.logout_at.is_(None),
                )
                .values(logout_at=now)
            )
            if commit:
                db.commit()
            else:
                db.flush()
        except Exception:
            pass

        sid = str(uuid.uuid4())
        row = cls.log(
            db=db,
            request=request,
            current_user=user,
            action="login",
            module_name="Authentication",
            details="User logged in successfully.",
            resource="auth",
            login_status="Success",
            session_id=sid,
            login_at=now,
            email_override=user.email,
            commit=commit,
        )
        if row is not None and role:
            row.role = role
            if commit:
                db.commit()
            else:
                db.flush()
        return row

    @classmethod
    def log_login_failed(
        cls,
        db: Session,
        *,
        request: Request,
        email: str,
        user: User | None = None,
        details: str | None = None,
        role: str | None = None,
    ) -> AccessLog | None:
        formatted_details = details
        if user and role:
            user_roles = [r.name for r in (getattr(user, "roles", None) or [])]
            if user_roles and role not in user_roles:
                assigned_str = ", ".join(user_roles)
                formatted_details = (
                    f"Role mismatch failure: Selected role '{role}' does not match account role(s) '{assigned_str}'."
                )

        return cls.log(
            db=db,
            request=request,
            current_user=user,
            action="login_failed",
            module_name="Authentication",
            details=formatted_details or "Invalid email or password.",
            resource="auth",
            login_status="Failed",
            email_override=email,
            role_override=role,
        )

    @classmethod
    def log_logout(
        cls,
        db: Session,
        *,
        request: Request | None,
        user: User,
    ) -> AccessLog | None:
        try:
            now = _utcnow()
            open_login = db.scalars(
                select(AccessLog)
                .where(
                    AccessLog.user_id == user.id,
                    AccessLog.action == "login",
                    AccessLog.login_status == "Success",
                    AccessLog.logout_at.is_(None),
                )
                .order_by(AccessLog.logged_at.desc())
            ).first()

            session_id = open_login.session_id if open_login else None
            login_at = open_login.login_at if open_login else None

            # Deduplication check: prevent creating duplicate logout records for the same session ID or recent request
            if session_id:
                existing_logout = db.scalars(
                    select(AccessLog).where(
                        AccessLog.user_id == user.id,
                        AccessLog.action == "logout",
                        AccessLog.session_id == session_id,
                    )
                ).first()
                if existing_logout:
                    logger.info("log_logout_skip_duplicate user_id=%s session_id=%s", user.id, session_id)
                    return existing_logout
            else:
                recent_logout = db.scalars(
                    select(AccessLog).where(
                        AccessLog.user_id == user.id,
                        AccessLog.action == "logout",
                        AccessLog.logged_at >= now - timedelta(seconds=5),
                    )
                ).first()
                if recent_logout:
                    logger.info("log_logout_skip_recent user_id=%s", user.id)
                    return recent_logout

            if open_login:
                db.execute(
                    update(AccessLog)
                    .where(AccessLog.id == open_login.id)
                    .values(
                        logout_at=now,
                    )
                )
                db.commit()

            return cls.log(
                db=db,
                request=request,
                current_user=user,
                action="logout",
                module_name="Authentication",
                details="User logged out successfully.",
                resource="auth",
                login_status="Logged Out",
                session_id=session_id,
                login_at=login_at,
                logout_at=now,
            )
        except SQLAlchemyError as exc:
            logger.exception("log_logout database error for user %s: %s", getattr(user, "id", None), exc)
            db.rollback()
            raise
        except Exception as exc:
            logger.exception("log_logout unexpected error for user %s: %s", getattr(user, "id", None), exc)
            db.rollback()
            raise


# ---------------------------------------------------------------------------
# Query / export helpers (used by API layer)
# ---------------------------------------------------------------------------

def _as_aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt


def _session_duration(login_at: datetime | None, logout_at: datetime | None) -> str | None:
    start, end = _as_aware(login_at), _as_aware(logout_at)
    if not start or not end:
        return None
    seconds = int((end - start).total_seconds())
    if seconds < 0:
        return None
    hours, rem = divmod(seconds, 3600)
    minutes, secs = divmod(rem, 60)
    if hours:
        return f"{hours}h {minutes}m"
    if minutes:
        return f"{minutes}m {secs}s"
    return f"{secs}s"


def format_audit_row(row: AccessLog) -> dict[str, Any]:
    logged = _as_aware(row.logged_at) or _as_aware(row.login_at)
    login_at = _as_aware(row.login_at) or logged
    logout_at = _as_aware(row.logout_at)
    return {
        "id": row.id,
        "tenant_id": row.tenant_id,
        "company_id": row.company_id or row.tenant_id,
        "company_name": row.company_name,
        "user_id": row.user_id,
        "full_name": row.full_name,
        "email": row.email,
        "role": row.role,
        "action": row.action,
        "module_name": row.module_name,
        "resource": row.resource,
        "resource_id": row.resource_id,
        "login_status": row.login_status,
        "ip_address": row.ip_address,
        "browser": row.browser,
        "operating_system": row.operating_system,
        "device_type": row.device_type,
        "session_id": row.session_id,
        "user_agent": row.user_agent,
        "login_at": login_at.isoformat() if login_at else None,
        "logout_at": logout_at.isoformat() if logout_at else None,
        "logged_at": logged.isoformat() if logged else None,
        "date": logged.strftime("%Y-%m-%d") if logged else None,
        "time": logged.strftime("%H:%M:%S") if logged else None,
        "logout_time": logout_at.strftime("%H:%M:%S") if logout_at else None,
        "session_duration": _session_duration(login_at, logout_at),
        "details": row.details,
        "created_at": row.created_at.isoformat() if getattr(row, "created_at", None) else None,
        "updated_at": row.updated_at.isoformat() if getattr(row, "updated_at", None) else None,
    }


def query_audit_logs(
    db: Session,
    current_user: User,
    *,
    scope: str = "visible",
    search: str | None = None,
    action: str | None = None,
    role: str | None = None,
    module_name: str | None = None,
    login_status: str | None = None,
    user_id: int | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    sort_by: str = "logged_at",
    sort_dir: str = "desc",
    page: int = 1,
    page_size: int = 25,
) -> dict:
    try:
        page = max(1, page)
        page_size = min(max(1, page_size), 500)

        if scope == "me":
            stmt = select(AccessLog).where(AccessLog.user_id == current_user.id)
        elif scope == "company":
            if not user_is_admin(current_user):
                raise HTTPException(status_code=403, detail="Administrator privileges are required.")
            stmt = select(AccessLog).where(
                or_(
                    AccessLog.company_id == current_user.tenant_id,
                    AccessLog.tenant_id == current_user.tenant_id,
                )
            )
        else:
            if user_is_admin(current_user):
                stmt = select(AccessLog).where(
                    or_(
                        AccessLog.company_id == current_user.tenant_id,
                        AccessLog.tenant_id == current_user.tenant_id,
                    )
                )
            else:
                stmt = select(AccessLog).where(AccessLog.user_id == current_user.id)

        filters = []
        if search:
            q = f"%{search.strip().lower()}%"
            filters.append(
                or_(
                    func.lower(AccessLog.full_name).like(q),
                    func.lower(AccessLog.email).like(q),
                    func.lower(AccessLog.action).like(q),
                    func.lower(AccessLog.module_name).like(q),
                    func.lower(AccessLog.company_name).like(q),
                    AccessLog.ip_address.like(q),
                )
            )
        if action:
            filters.append(AccessLog.action == action)
        if role:
            filters.append(AccessLog.role == role)
        if module_name:
            filters.append(AccessLog.module_name == module_name)
        if login_status:
            filters.append(AccessLog.login_status == login_status)
        if user_id:
            filters.append(AccessLog.user_id == user_id)
        if date_from:
            filters.append(AccessLog.logged_at >= date_from)
        if date_to:
            filters.append(AccessLog.logged_at <= date_to)
        if filters:
            stmt = stmt.where(and_(*filters))

        sort_col = getattr(AccessLog, sort_by, AccessLog.logged_at)
        stmt = stmt.order_by(sort_col.asc() if sort_dir == "asc" else sort_col.desc())
        total = int(db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0)
        rows = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
        return {
            "items": [format_audit_row(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "pages": max(1, (total + page_size - 1) // page_size),
        }
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("query_audit_logs database error: %s", exc)
        db.rollback()
        raise
    except Exception as exc:
        logger.exception("query_audit_logs unexpected error: %s", exc)
        db.rollback()
        raise


def export_audit_logs_csv(db: Session, current_user: User, *, scope: str = "visible", **filters) -> str:
    """Export audit logs as a CSV string.

    Raises:
        SQLAlchemyError: Re-raised after rollback when a database failure occurs
            so the API layer can return an appropriate 503 response.
        Exception: Re-raised after rollback for any unexpected runtime error so
            the API layer can return a 500 response instead of crashing.
    """
    try:
        result = query_audit_logs(db, current_user, scope=scope, page=1, page_size=5000, **filters)
        buf = io.StringIO()
        fields = [
            "date", "time", "company_name", "full_name", "email", "role", "module_name",
            "action", "login_status", "ip_address", "browser", "operating_system",
            "device_type", "logout_time", "session_duration", "details",
        ]
        writer = csv.DictWriter(buf, fieldnames=fields)
        writer.writeheader()
        for item in result["items"]:
            writer.writerow({k: item.get(k) or "" for k in fields})
        return buf.getvalue()
    except SQLAlchemyError as exc:
        logger.exception("export_audit_logs_csv database error: %s", exc)
        db.rollback()
        raise
    except Exception as exc:
        logger.exception("export_audit_logs_csv unexpected error: %s", exc)
        db.rollback()
        raise


def delete_audit_log(db: Session, *, log_id: int, admin: User) -> None:
    """Delete a single audit log entry.

    Raises:
        HTTPException: 403/404 for authorisation / not-found conditions.
        SQLAlchemyError: Re-raised after rollback when the DELETE or COMMIT
            fails at the database level so the API layer can return a 500.
        Exception: Re-raised after rollback for any other unexpected failure.
    """
    if not user_is_admin(admin):
        raise HTTPException(status_code=403, detail="Administrator privileges are required.")
    row = db.get(AccessLog, log_id)
    if not row:
        raise HTTPException(status_code=404, detail="Audit log not found.")
    if (row.company_id or row.tenant_id) != admin.tenant_id:
        raise HTTPException(status_code=403, detail="Cannot delete logs outside your company.")
    try:
        db.delete(row)
        db.commit()
    except SQLAlchemyError as exc:
        logger.exception(
            "delete_audit_log database error for log_id=%s admin_id=%s: %s",
            log_id, getattr(admin, "id", None), exc,
        )
        db.rollback()
        raise
    except Exception as exc:
        logger.exception(
            "delete_audit_log unexpected error for log_id=%s admin_id=%s: %s",
            log_id, getattr(admin, "id", None), exc,
        )
        db.rollback()
        raise


def recent_login_activity(db: Session, current_user: User, *, limit: int = 10) -> list[dict]:
    """Return the most recent login/login_failed events visible to current_user.

    Raises:
        SQLAlchemyError: Re-raised after rollback when a database failure occurs
            so the API layer can return an appropriate 503 response.
        Exception: Re-raised after rollback for any other unexpected failure so
            the API layer can return a 500 response.
    """
    try:
        stmt = (
            select(AccessLog)
            .where(
                or_(
                    AccessLog.company_id == current_user.tenant_id,
                    AccessLog.tenant_id == current_user.tenant_id,
                ),
                AccessLog.action.in_(("login", "login_failed")),
            )
            .order_by(AccessLog.logged_at.desc())
            .limit(limit)
        )
        if not user_is_admin(current_user):
            stmt = stmt.where(AccessLog.user_id == current_user.id)
        return [format_audit_row(r) for r in db.scalars(stmt).all()]
    except SQLAlchemyError as exc:
        logger.exception(
            "recent_login_activity database error user_id=%s limit=%s: %s",
            getattr(current_user, "id", None), limit, exc,
        )
        db.rollback()
        raise
    except Exception as exc:
        logger.exception(
            "recent_login_activity unexpected error user_id=%s limit=%s: %s",
            getattr(current_user, "id", None), limit, exc,
        )
        db.rollback()
        raise
