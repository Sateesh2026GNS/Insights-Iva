"""Sidebar, roles, and permissions catalog APIs for RBAC."""

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import get_role_names, require_admin, user_has_permission, user_is_admin
from app.core.rbac_constants import (
    MODULE_CATALOG,
    PERMISSION_MATRIX,
    REGISTERABLE_ROLES,
    SIDEBAR_MENU_CATALOG,
)
from app.models.permission import Permission
from app.models.role import Role
from app.models.user import User
from app.schemas.auth import (
    PermissionItemResponse,
    RoleOptionResponse,
    SidebarChildResponse,
    SidebarItemResponse,
    UserResponse,
)
from app.schemas.rbac import UserCreate, UserUpdate
from app.services.auth_service import decode_access_token, get_user_with_role
from app.services.settings_service import SettingsService

router = APIRouter(tags=["rbac"])

PRODUCTION_MANAGER_ALLOWED_SECTIONS = {
    "dashboard",
    "masters",
    "production",
    "inventory",
    "procurement",
    "quality",
    "maintenance",
    "alerts",
    "documents",
    "analytics",
}

PRODUCTION_MANAGER_ALLOWED_CHILDREN = {
    "/masters/products",
    "/masters/bom",
    "/manufacturing/workflow",
    "/production/machines",
    "/production/planning",
    "/production/work-orders",
    "/production/job-card",
    "/production/schedule",
    "/factory-monitor/live-production",
    "/production/tasks",
    "/production/assign-tasks",
    "/production/batches",
    "/production/reports",
    "/inventory/raw-materials",
    "/inventory/finished-goods",
    "/inventory/stock-transfer",
    "/procurement/material-requests",
    "/quality/in-process",
    "/quality/final",
    "/quality/defects",
    "/maintenance/preventive",
    "/maintenance/breakdowns",
    "/maintenance/machine-history",
    "/alerts",
    "/alerts/low-stock",
    "/alerts/machine-failure",
    "/alerts/production-delay",
    "/alerts/maintenance",
    "/alerts/quality",
    "/alerts/safety",
    "/alerts/general",
    "/documents",
    "/documents/production",
    "/documents/quality",
    "/documents/reports",
    "/analytics/production",
    "/analytics/inventory",
    "/analytics/live",
}


def _user_can_see_module(user: User, module: str) -> bool:
    if user_is_admin(user):
        return True
    user_roles_list = [r.lower() for r in get_role_names(user)]
    if any("production manager" in r or "production_manager" in r for r in user_roles_list):
        if module in PRODUCTION_MANAGER_ALLOWED_SECTIONS:
            return True
    return user_has_permission(user, module)


def _svc(db: Session, admin: User) -> SettingsService:
    return SettingsService(db, admin)



@router.get("/roles", response_model=list[RoleOptionResponse])
def list_registerable_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Authenticated list of roles (registration is disabled in SaaS mode)."""
    _ = current_user
    _ = db
    items = []
    for name in REGISTERABLE_ROLES:
        spec = PERMISSION_MATRIX.get(name, {})
        items.append(
            RoleOptionResponse(
                id=name.lower().replace(" ", "_"),
                name=name,
                description=spec.get("description", ""),
            )
        )
    return items


@router.get("/roles/tenant", response_model=list[dict])
def list_tenant_roles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Roles defined for the authenticated user's company."""
    roles = db.scalars(
        select(Role).where(Role.tenant_id == current_user.tenant_id).order_by(Role.name)
    ).all()
    return [
        {
            "id": r.id,
            "role_name": r.name,
            "description": r.description,
            "permissions": r.permissions or [],
        }
        for r in roles
    ]


@router.get("/permissions", response_model=list[PermissionItemResponse])
def list_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permission catalog (module + permission name)."""
    rows = list(db.scalars(select(Permission).order_by(Permission.module_name)).all())
    if rows:
        return [
            PermissionItemResponse(
                id=p.id,
                module_name=p.module_name,
                permission_name=p.permission_name,
                code=f"{p.module_name}:{p.permission_name}"
                if p.permission_name != "access"
                else p.module_name,
            )
            for p in rows
        ]
    # Fallback from constants if catalog not seeded yet
    items = []
    for mod in MODULE_CATALOG:
        items.append(
            PermissionItemResponse(
                module_name=mod["code"],
                permission_name="access",
                code=mod["code"],
            )
        )
    return items


@router.get("/sidebar", response_model=list[SidebarItemResponse])
def get_sidebar_menus(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return only sidebar menus allowed for the logged-in role."""
    user_roles_list = [r.lower() for r in get_role_names(current_user)]
    is_admin = any("admin" in r for r in user_roles_list)
    is_prod_manager = not is_admin and any(
        "production manager" in r or "production_manager" in r for r in user_roles_list
    )

    menus: list[SidebarItemResponse] = []
    for section in SIDEBAR_MENU_CATALOG:
        if is_prod_manager and section["key"] not in PRODUCTION_MANAGER_ALLOWED_SECTIONS:
            continue
        if section["key"] == "alerts" and "Operator" in [r.name for r in current_user.roles]:
            continue
        children_src = section.get("children") or []
        # Parent module must be granted (prevents Operator seeing Masters via Machines).
        if not _user_can_see_module(current_user, section["module"]):
            continue

        if children_src:
            allowed_children = []
            for c in children_src:
                if is_prod_manager and c["path"] not in PRODUCTION_MANAGER_ALLOWED_CHILDREN:
                    continue
                if _user_can_see_module(current_user, c["module"]):
                    allowed_children.append(
                        SidebarChildResponse(
                            label=c["label"],
                            path=c["path"],
                            module=c["module"],
                        )
                    )
            if allowed_children:
                menus.append(
                    SidebarItemResponse(
                        key=section["key"],
                        label=section["label"],
                        path=section.get("path"),
                        module=section["module"],
                        children=allowed_children,
                    )
                )
            continue

        menus.append(
            SidebarItemResponse(
                key=section["key"],
                label=section["label"],
                path=section.get("path"),
                module=section["module"],
                children=[],
            )
        )
    return menus


@router.get("/sidebar/labels", response_model=list[str])
def get_sidebar_labels(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Flat label list of allowed menus (for compact clients)."""
    menus = get_sidebar_menus(current_user=current_user, db=db)
    labels: list[str] = []
    for m in menus:
        labels.append(m.label)
        for c in m.children:
            labels.append(c.label)
    return labels


@router.get("/profile", response_model=UserResponse)
def get_profile(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    role_from_token = None
    auth_header = request.headers.get("Authorization") or ""
    if auth_header.startswith("Bearer "):
        payload = decode_access_token(auth_header[7:])
        if payload:
            role_from_token = payload.get("role") or payload.get("role_name")
    data = get_user_with_role(db, current_user, preferred_role=role_from_token)
    data["email_verified"] = current_user.email_verified
    return UserResponse(**data)


@router.get("/team-directory")
def team_directory(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Tenant-scoped active users for assignee / sales-person pickers (non-admin safe)."""
    from app.services.rbac_service import list_users

    users = list_users(db, current_user.tenant_id)
    return [
        {
            "id": u["id"],
            "full_name": u.get("full_name"),
            "email": u.get("email"),
            "name": u.get("full_name") or u.get("email"),
            "role": u.get("role"),
            "is_active": u.get("is_active", True),
        }
        for u in users
        if u.get("is_active", True)
    ]


# ---------------------------------------------------------------------------
# Company-scoped user management (Admin only)
# ---------------------------------------------------------------------------
@router.get("/users")
def list_users(admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    return _svc(db, admin).list_users()


@router.post("/users", status_code=201)
def create_user(
    payload: UserCreate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return _svc(db, admin).create_user(payload, request)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating user in RBAC API: %s", exc)
        raise HTTPException(status_code=500, detail="Database error creating user") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create user in RBAC API: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to create user") from exc


@router.put("/users/{user_id}")
def update_user(
    user_id: int,
    payload: UserUpdate,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return _svc(db, admin).update_user(user_id, payload, request)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error updating user_id=%s in RBAC API: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Database error updating user") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to update user_id=%s in RBAC API: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Failed to update user") from exc


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    try:
        return _svc(db, admin).delete_user(user_id, request)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error deleting user_id=%s in RBAC API: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Database error deleting user") from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete user_id=%s in RBAC API: %s", user_id, exc)
        raise HTTPException(status_code=500, detail="Failed to delete user") from exc


@router.post("/users/{user_id}/reset-password")
def admin_reset_user_password(
    user_id: int,
    request: Request,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Admin-only: send a password reset link to the user's company email."""
    from app.services.password_reset_service import PasswordResetService

    message = PasswordResetService(db).admin_trigger_reset(
        user_id=user_id,
        tenant_id=admin.tenant_id,
        admin_user_id=admin.id,
        request=request,
    )
    return {"success": True, "message": message}
