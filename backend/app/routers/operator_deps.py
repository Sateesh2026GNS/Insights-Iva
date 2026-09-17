"""Shared dependencies for Operator /api routes."""

from fastapi import Depends, HTTPException, status

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
    if module_key in ("notifications", "products", "bom", "masters", "machines", "vendors"):
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


def deny_operator_production_planning(current_user: User = Depends(get_current_user)) -> User:
    """Block shop-floor operators from planning / allocation manager APIs."""
    if user_is_admin(current_user):
        return current_user
    roles = {r.strip().lower() for r in get_role_names(current_user) if r}
    if "operator" in roles and not any("manager" in r or "admin" in r for r in roles):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Production planning and machine allocation are restricted to managers.",
        )
    return current_user


def deny_delete_for_operator(current_user: User = Depends(get_current_user)) -> User:
    if not user_is_admin(current_user) and "Operator" in get_role_names(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Operators are not allowed to perform delete operations.",
        )
    return current_user
