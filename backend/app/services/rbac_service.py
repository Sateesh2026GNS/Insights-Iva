"""Admin user & role management service (CRUD + activity logging)."""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session, selectinload

logger = logging.getLogger(__name__)

from app.core.permissions import ADMIN_ROLE, get_role_names, get_user_permissions, is_valid_permission
from app.models.security import AccessLog
from app.models.role import Role
from app.models.user import User
from app.schemas.rbac import RoleCreate, RoleUpdate, UserCreate, UserUpdate
from app.services.auth_service import hash_password


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------
def serialize_user(u: User) -> dict:
    role_names = get_role_names(u)
    return {
        "id": u.id,
        "email": u.email,
        "full_name": u.full_name,
        "phone": getattr(u, "phone", None),
        "employee_id": getattr(u, "employee_id", None),
        "designation": getattr(u, "designation", None),
        "is_active": u.is_active,
        "tenant_id": u.tenant_id,
        "roles": [{"id": r.id, "name": r.name} for r in u.roles],
        "role": role_names[0] if role_names else None,
        "team": role_names[0] if role_names else "—",
        "permissions": sorted(get_user_permissions(u)),
        "plant_code": getattr(u, "plant_code", None),
        "department": getattr(u, "department", None),
        "assigned_machine_id": getattr(u, "assigned_machine_id", None),
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


def serialize_role(r: Role) -> dict:
    users = r.users if r.users is not None else []
    return {
        "id": r.id,
        "name": r.name,
        "description": r.description or "",
        "permissions": r.permissions or [],
        "user_count": len(users),
        "is_system": r.name == ADMIN_ROLE,
    }


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------
def _get_user_or_404(db: Session, tenant_id: int, user_id: int) -> User:
    u = db.scalars(
        select(User)
        .where(User.id == user_id, User.tenant_id == tenant_id)
        .options(selectinload(User.roles))
    ).first()
    if not u:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return u


def _get_role_or_404(db: Session, tenant_id: int, role_id: int) -> Role:
    r = db.scalars(
        select(Role)
        .where(Role.id == role_id, Role.tenant_id == tenant_id)
        .options(selectinload(Role.users))
    ).first()
    if not r:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Role not found")
    return r


def _resolve_roles(db: Session, tenant_id: int, role_ids: list[int]) -> list[Role]:
    if not role_ids:
        return []
    roles = list(
        db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.id.in_(role_ids))
        ).all()
    )
    missing = set(role_ids) - {r.id for r in roles}
    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown role id(s): {sorted(missing)}",
        )
    return roles


def _validate_modules(permissions: list[str]) -> list[str]:
    cleaned = [p for p in dict.fromkeys(permissions)]
    invalid = [p for p in cleaned if not is_valid_permission(p)]
    if invalid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown permission code(s): {invalid}",
        )
    return cleaned


def _active_admin_count(db: Session, tenant_id: int, exclude_user_id: int | None = None) -> int:
    users = db.scalars(
        select(User).where(User.tenant_id == tenant_id).options(selectinload(User.roles))
    ).all()
    count = 0
    for u in users:
        if exclude_user_id is not None and u.id == exclude_user_id:
            continue
        if u.is_active and ADMIN_ROLE in [r.name for r in u.roles]:
            count += 1
    return count


# ---------------------------------------------------------------------------
# User CRUD
# ---------------------------------------------------------------------------
def list_users(db: Session, tenant_id: int) -> list[dict]:
    stmt = (
        select(User)
        .where(User.tenant_id == tenant_id)
        .options(selectinload(User.roles))
        .order_by(User.full_name)
    )
    return [serialize_user(u) for u in db.scalars(stmt).all()]


def get_user(db: Session, tenant_id: int, user_id: int) -> dict:
    return serialize_user(_get_user_or_404(db, tenant_id, user_id))


def create_user(db: Session, tenant_id: int, payload: UserCreate) -> dict:
    from app.core.company_email import (
        MSG_EMAIL_NOT_WITH_COMPANY,
        MSG_PUBLIC_EMAIL,
        email_domain,
        is_public_email_domain,
        user_email_matches_company,
    )
    from app.models.tenant import Tenant

    try:
        existing = db.scalars(select(User).where(User.email == payload.email)).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )
        if is_public_email_domain(email_domain(payload.email)):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=MSG_PUBLIC_EMAIL)

        emp_id = (payload.employee_id or "").strip()
        if emp_id:
            existing_emp = db.scalars(
                select(User).where(
                    User.tenant_id == tenant_id,
                    func.lower(User.employee_id) == emp_id.lower(),
                )
            ).first()
            if existing_emp:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Employee ID '{emp_id}' is already in use by {existing_emp.full_name} ({existing_emp.email})",
                )

        company = db.get(Tenant, tenant_id)
        if company and company.email and not user_email_matches_company(payload.email, company):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=MSG_EMAIL_NOT_WITH_COMPANY,
            )

        roles = _resolve_roles(db, tenant_id, payload.role_ids)
        user = User(
            tenant_id=tenant_id,
            email=payload.email,
            full_name=payload.full_name,
            phone=payload.phone,
            employee_id=emp_id or None,
            designation=payload.designation,
            is_active=payload.is_active,
            hashed_password=hash_password(payload.password),
            email_verified=True,
            plant_code=payload.plant_code,
            department=payload.department,
            assigned_machine_id=payload.assigned_machine_id,
        )
        user.roles = roles
        db.add(user)
        db.commit()
        return get_user(db, tenant_id, user.id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating user with email=%s, tenant_id=%s: %s", payload.email, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error creating user") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create user with email=%s, tenant_id=%s: %s", payload.email, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to create user") from exc


def update_user(
    db: Session, tenant_id: int, user_id: int, payload: UserUpdate, acting_user: User
) -> dict:
    try:
        user = _get_user_or_404(db, tenant_id, user_id)
        data = payload.model_dump(exclude_unset=True)

        if "email" in data and data["email"] and data["email"] != user.email:
            clash = db.scalars(
                select(User).where(User.email == data["email"], User.id != user.id)
            ).first()
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT, detail="Email already in use"
                )
            user.email = data["email"]

        if data.get("full_name"):
            user.full_name = data["full_name"]
        if "phone" in data:
            user.phone = data["phone"]
        if "employee_id" in data:
            emp_id = (data["employee_id"] or "").strip()
            if emp_id:
                clash_emp = db.scalars(
                    select(User).where(
                        User.tenant_id == tenant_id,
                        func.lower(User.employee_id) == emp_id.lower(),
                        User.id != user.id,
                    )
                ).first()
                if clash_emp:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail=f"Employee ID '{emp_id}' is already in use by {clash_emp.full_name} ({clash_emp.email})",
                    )
                user.employee_id = emp_id
            else:
                user.employee_id = None
        if "designation" in data:
            user.designation = data["designation"]
        if data.get("password"):
            from app.services.password_history_service import (
                assert_password_not_reused,
                record_password_history,
            )
            from app.services.security_service import revoke_all_refresh_tokens_for_user

            try:
                assert_password_not_reused(db, user, data["password"])
            except ValueError as exc:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=str(exc),
                ) from exc
            if user.hashed_password:
                record_password_history(db, user.id, user.hashed_password)
            user.hashed_password = hash_password(data["password"])
            revoke_all_refresh_tokens_for_user(db, user.id)

        if "is_active" in data and data["is_active"] is not None:
            if not data["is_active"] and user.id == acting_user.id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You cannot deactivate your own account",
                )
            if (
                not data["is_active"]
                and ADMIN_ROLE in get_role_names(user)
                and _active_admin_count(db, tenant_id, exclude_user_id=user.id) == 0
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot deactivate the last active administrator",
                )
            user.is_active = data["is_active"]

        if "role_ids" in data and data["role_ids"] is not None:
            new_roles = _resolve_roles(db, tenant_id, data["role_ids"])
            was_admin = ADMIN_ROLE in get_role_names(user)
            will_be_admin = ADMIN_ROLE in [r.name for r in new_roles]
            if (
                was_admin
                and not will_be_admin
                and _active_admin_count(db, tenant_id, exclude_user_id=user.id) == 0
            ):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the administrator role from the last admin",
                )
            user.roles = new_roles

        if "plant_code" in data:
            user.plant_code = data["plant_code"]
        if "department" in data:
            user.department = data["department"]
        if "assigned_machine_id" in data:
            user.assigned_machine_id = data["assigned_machine_id"]

        db.commit()
        return get_user(db, tenant_id, user.id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating user_id=%s, tenant_id=%s: %s", user_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error updating user") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update user_id=%s, tenant_id=%s: %s", user_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update user") from exc


def delete_user(db: Session, tenant_id: int, user_id: int, acting_user: User) -> None:
    try:
        user = _get_user_or_404(db, tenant_id, user_id)
        if user.id == acting_user.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot delete your own account",
            )
        if (
            ADMIN_ROLE in get_role_names(user)
            and _active_admin_count(db, tenant_id, exclude_user_id=user.id) == 0
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot delete the last administrator",
            )
        db.delete(user)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error deleting user_id=%s, tenant_id=%s: %s", user_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error deleting user") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete user_id=%s, tenant_id=%s: %s", user_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to delete user") from exc


# ---------------------------------------------------------------------------
# Role CRUD
# ---------------------------------------------------------------------------
def list_roles(db: Session, tenant_id: int) -> list[dict]:
    """Ensure default RBAC roles exist (e.g. Sales Manager), then list for tenant."""
    try:
        from app.core.seed_roles import seed_roles_for_tenant

        seed_roles_for_tenant(db, tenant_id, commit=True)
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        logger.warning(
            "Role seeding encountered an exception for tenant_id=%s, proceeding to query existing roles: %s",
            tenant_id,
            exc,
        )

    try:
        stmt = (
            select(Role)
            .where(Role.tenant_id == tenant_id)
            .options(selectinload(Role.users))
            .order_by(Role.name)
        )
        return [serialize_role(r) for r in db.scalars(stmt).all()]
    except Exception as exc:
        try:
            db.rollback()
        except Exception:
            pass
        logger.exception("Failed to retrieve roles for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve roles.",
        ) from exc


def get_role(db: Session, tenant_id: int, role_id: int) -> dict:
    return serialize_role(_get_role_or_404(db, tenant_id, role_id))


def create_role(db: Session, tenant_id: int, payload: RoleCreate) -> dict:
    try:
        exists = db.scalars(
            select(Role).where(Role.tenant_id == tenant_id, Role.name == payload.name)
        ).first()
        if exists:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A role with this name already exists",
            )
        from app.core.seed_permissions import sync_role_permissions

        role = Role(
            tenant_id=tenant_id,
            name=payload.name,
            description=payload.description,
            permissions=_validate_modules(payload.permissions or []),
        )
        db.add(role)
        db.flush()
        sync_role_permissions(db, tenant_id)
        db.commit()
        return get_role(db, tenant_id, role.id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating role name=%s for tenant_id=%s: %s", payload.name, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error creating role") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create role name=%s for tenant_id=%s: %s", payload.name, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to create role") from exc


def update_role(db: Session, tenant_id: int, role_id: int, payload: RoleUpdate) -> dict:
    try:
        role = _get_role_or_404(db, tenant_id, role_id)
        data = payload.model_dump(exclude_unset=True)

        if "name" in data and data["name"] and data["name"] != role.name:
            if role.name == ADMIN_ROLE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The Admin role cannot be renamed",
                )
            clash = db.scalars(
                select(Role).where(
                    Role.tenant_id == tenant_id,
                    Role.name == data["name"],
                    Role.id != role.id,
                )
            ).first()
            if clash:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="A role with this name already exists",
                )
            role.name = data["name"]

        if "description" in data:
            role.description = data["description"]

        if "permissions" in data and data["permissions"] is not None:
            if role.name == ADMIN_ROLE:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="The Admin role always has full access and cannot be restricted",
                )
            from sqlalchemy.orm.attributes import flag_modified

            from app.core.seed_permissions import sync_role_permissions

            role.permissions = _validate_modules(data["permissions"])
            flag_modified(role, "permissions")
            sync_role_permissions(db, tenant_id)

        db.commit()
        db.refresh(role)
        return get_role(db, tenant_id, role.id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating role_id=%s for tenant_id=%s: %s", role_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error updating role") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update role_id=%s for tenant_id=%s: %s", role_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update role") from exc


def delete_role(db: Session, tenant_id: int, role_id: int) -> None:
    try:
        role = _get_role_or_404(db, tenant_id, role_id)
        if role.name == ADMIN_ROLE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="The Admin role cannot be deleted",
            )
        if role.users:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot delete a role assigned to {len(role.users)} user(s). Reassign them first.",
            )
        db.delete(role)
        db.commit()
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error deleting role_id=%s for tenant_id=%s: %s", role_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Database error deleting role") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete role_id=%s for tenant_id=%s: %s", role_id, tenant_id, exc)
        raise HTTPException(status_code=500, detail="Failed to delete role") from exc


def update_role_permissions(
    db: Session, tenant_id: int, role_id: int, permissions: list[str]
) -> dict:
    return update_role(db, tenant_id, role_id, RoleUpdate(permissions=permissions))


def get_user_stats(db: Session, tenant_id: int) -> dict:
    users = db.scalars(
        select(User).where(User.tenant_id == tenant_id).options(selectinload(User.roles))
    ).all()
    total = len(users)
    active = sum(1 for u in users if u.is_active)
    administrators = sum(
        1 for u in users if u.is_active and ADMIN_ROLE in get_role_names(u)
    )
    return {
        "total_users": total,
        "active_users": active,
        "administrators": administrators,
        "inactive_users": total - active,
    }


# ---------------------------------------------------------------------------
# Activity logging
# ---------------------------------------------------------------------------
def log_activity(
    db: Session,
    *,
    tenant_id: int,
    user_id: int | None,
    action: str,
    resource: str | None = None,
    resource_id: int | None = None,
    request=None,
    details: str | None = None,
    module_name: str | None = None,
) -> None:
    from app.services.audit_log_service import AuditLogService, resolve_module
    from sqlalchemy.orm import selectinload
    from sqlalchemy import select

    user = None
    if user_id is not None:
        user = db.scalars(
            select(User)
            .where(User.id == user_id)
            .options(selectinload(User.roles), selectinload(User.tenant))
        ).first()
    AuditLogService.log(
        db=db,
        request=request,
        current_user=user,
        action=action,
        module_name=module_name or resolve_module(action, resource),
        details=details or f"{action} {resource or ''}".strip(),
        resource=resource,
        resource_id=resource_id,
    )

def list_activities(
    db: Session,
    tenant_id: int,
    *,
    search: str | None = None,
    page: int = 1,
    page_size: int = 200,
) -> dict:
    try:
        page = max(1, page)
        page_size = min(max(1, page_size), 500)
        offset = (page - 1) * page_size

        base = select(AccessLog).where(AccessLog.tenant_id == tenant_id)
        rows = db.scalars(
            base.order_by(AccessLog.logged_at.desc()).offset(offset).limit(page_size)
        ).all()

        user_ids = {r.user_id for r in rows if r.user_id is not None}
        names: dict[int, str] = {}
        if user_ids:
            for u in db.scalars(select(User).where(User.id.in_(user_ids))).all():
                names[u.id] = u.full_name

        from app.services.audit_log_service import format_audit_row

        items = []
        for r in rows:
            formatted = format_audit_row(r)
            formatted["user_name"] = names.get(r.user_id, r.full_name or "System") if r.user_id else (r.full_name or "System")
            items.append(formatted)

        if search:
            needle = search.strip().lower()
            if needle:
                items = [
                    item
                    for item in items
                    if needle in (item["user_name"] or "").lower()
                    or needle in (item["action"] or "").lower()
                    or needle in (item["resource"] or "").lower()
                    or needle in (item["ip_address"] or "").lower()
                ]

        total = len(items) if search else int(
            db.scalar(
                select(func.count()).select_from(
                    select(AccessLog).where(AccessLog.tenant_id == tenant_id).subquery()
                )
            )
            or 0
        )

        return {
            "items": items,
            "total": total,
            "page": page,
            "page_size": page_size,
        }
    except SQLAlchemyError as exc:
        logger.exception("list_activities database error for tenant %s: %s", tenant_id, exc)
        db.rollback()
        raise
    except Exception as exc:
        logger.exception("list_activities unexpected error for tenant %s: %s", tenant_id, exc)
        db.rollback()
        raise


def list_activities_legacy(db: Session, tenant_id: int, limit: int = 200) -> list[dict]:
    """Backward-compatible flat list for legacy /admin/access-logs consumers."""
    return list_activities(db, tenant_id, page_size=limit)["items"]
