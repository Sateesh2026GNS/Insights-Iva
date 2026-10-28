"""Shared dependencies for Operator /api routes."""

from fastapi import Depends, HTTPException, Request, status

from app.api.auth_deps import get_current_user
from app.core.permissions import (
    MODULE_FORBIDDEN_MESSAGE,
    get_role_names,
    user_has_any_permission,
    user_has_permission,
    user_is_admin,
)
from app.models.user import User

FORBIDDEN_MODULES = frozenset()

MODULE_MAP = {
    "dashboard": "dashboard",
    "products": "sales",
    "vendors": "masters",
    "bom": "production",
    "machines": "production",
    "production": "production",
    "workorders": "production",
    "allocation": "production",
    "batches": "production",
    "notifications": "production",
    "ai": "production",
}


def _check_operator_restrictions(user: User, module_key: str) -> None:
    from app.services.operator_scope import is_shop_floor_operator

    if module_key in {"products", "bom", "batches"} and is_shop_floor_operator(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operators cannot access this resource",
        )
    if module_key == "bom":
        # BOM authoring is for production/planning or masters-authorized members.
        if user_has_any_permission(user, "masters", "production", "admin"):
            return
    if module_key in ("notifications", "products", "masters", "machines", "vendors"):
        if user_has_any_permission(
            user, "masters", "production", "inventory", "sales", "admin", "procurement"
        ):
            return
    rbac_module = MODULE_MAP.get(module_key, module_key)
    if not user_has_permission(user, rbac_module):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=MODULE_FORBIDDEN_MESSAGE,
        )


def require_api_access(module_key: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        _check_operator_restrictions(current_user, module_key)
        return current_user

    return dependency


def require_tenant(module_key: str):
    def dependency(current_user: User = Depends(require_api_access(module_key))) -> tuple[User, int]:
        return current_user, current_user.tenant_id

    return dependency


def reject_shop_floor_operator(user: User) -> None:
    from app.services.operator_scope import is_shop_floor_operator

    if is_shop_floor_operator(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operators cannot access this resource",
        )


def deny_operator_production_planning(current_user: User = Depends(get_current_user)) -> User:
    """Block shop-floor operators from planning / allocation manager APIs."""
    reject_shop_floor_operator(current_user)
    return current_user


def guard_operator_manufacturing(request: Request, user: User = Depends(get_current_user)) -> None:
    """Operators may open only their stage card and the job-card actions that enforce ownership."""
    from app.services.operator_scope import is_shop_floor_operator

    if not is_shop_floor_operator(user):
        return
    path = request.url.path
    if "/production/job-cards/" in path or path.rstrip("/").endswith("/stage/operator"):
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Operators cannot access this resource",
    )


def deny_delete_for_operator(current_user: User = Depends(get_current_user)) -> User:
    if not user_is_admin(current_user) and "Operator" in get_role_names(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operators are not allowed to perform delete operations.",
        )
    return current_user
