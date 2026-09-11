"""Role-Based Access Control (RBAC) helpers and FastAPI dependencies."""

import json

from fastapi import Depends, HTTPException, status

from app.api.auth_deps import get_current_user
from app.core.rbac_constants import MODULE_CATALOG, PERMISSION_MATRIX, VALID_ACTIONS, VALID_MODULES
from app.models.user import User

ADMIN_ROLE = "Admin"
RESTRICTED_ACTION_ROLES = frozenset({"Operator"})


def is_valid_permission(code: str) -> bool:
    if code in VALID_MODULES or code in ("admin", "*"):
        return True
    if ":" not in code:
        return False
    module, action = code.split(":", 1)
    return module in VALID_MODULES and action in VALID_ACTIONS


def get_role_names(user: User) -> list[str]:
    if not user:
        return []
    try:
        names = []
        roles = getattr(user, "roles", []) or []
        for r in roles:
            if hasattr(r, "name") and r.name:
                names.append(r.name)
            elif isinstance(r, str):
                names.append(r)
        if hasattr(user, "role") and getattr(user, "role"):
            names.append(str(getattr(user, "role")))
        if hasattr(user, "role_name") and getattr(user, "role_name"):
            names.append(str(getattr(user, "role_name")))
        if isinstance(user, dict):
            if "role" in user and user["role"]:
                names.append(str(user["role"]))
            if "role_name" in user and user["role_name"]:
                names.append(str(user["role_name"]))
            if "roles" in user and isinstance(user["roles"], list):
                names.extend([str(r) for r in user["roles"]])
        return names
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("get_role_names failed for user %s: %s", getattr(user, "id", None), exc)
        return []


def _normalize_permissions(raw_permissions) -> list[str]:
    if raw_permissions is None:
        return []
    if isinstance(raw_permissions, str):
        try:
            loaded = json.loads(raw_permissions)
        except ValueError:
            return [raw_permissions]
        return list(loaded) if isinstance(loaded, list) else [raw_permissions]
    if isinstance(raw_permissions, (list, tuple, set)):
        return list(raw_permissions)
    return [raw_permissions]


def _permissions_for_role_name(name: str) -> list[str]:
    spec = PERMISSION_MATRIX.get(name, {})
    perms = list(spec.get("modules", []))
    perms.extend(spec.get("actions", []))
    if name == "Admin":
        return sorted(VALID_MODULES)
    return sorted(set(perms))


def get_user_permissions(user: User) -> set[str]:
    perms: set[str] = set()
    if not user:
        return perms
    try:
        roles = getattr(user, "roles", []) or []
        for role in roles:
            normalized = _normalize_permissions(getattr(role, "permissions", None))
            role_name = getattr(role, "name", None) if hasattr(role, "name") else (
                role if isinstance(role, str) else None
            )
            if normalized:
                perms.update(normalized)
            elif role_name and role_name in PERMISSION_MATRIX:
                perms.update(_permissions_for_role_name(role_name))
        if not roles:
            for name in get_role_names(user):
                if name in PERMISSION_MATRIX:
                    perms.update(_permissions_for_role_name(name))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("get_user_permissions failed for user %s: %s", getattr(user, "id", None), exc)
    return perms


def user_is_admin(user: User) -> bool:
    try:
        if ADMIN_ROLE in get_role_names(user):
            return True
        perms = get_user_permissions(user)
        return "admin" in perms or "*" in perms
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("user_is_admin check failed for user %s: %s", getattr(user, "id", None), exc)
        return False


def user_has_permission(user: User, module: str) -> bool:
    if module == "meetings":
        return True
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if "admin" in perms or "*" in perms:
        return True
    return module in perms


def user_has_any_permission(user: User, *modules: str) -> bool:
    if "meetings" in modules:
        return True
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if "admin" in perms or "*" in perms:
        return True
    return any(m in perms for m in modules)


def user_can_action(user: User, module: str, action: str) -> bool:
    if module == "meetings":
        return True
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if "admin" in perms or "*" in perms or f"{module}:*" in perms:
        return True
    if f"{module}:{action}" in perms:
        return True
    role_names = set(get_role_names(user))
    if role_names.intersection(RESTRICTED_ACTION_ROLES):
        return action in ("read", "view") and module in perms
    return module in perms


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not user_is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required to perform this action.",
        )
    return current_user


MODULE_FORBIDDEN_MESSAGE = "You do not have permission to access this module."


def require_permission(module: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(current_user, module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MODULE_FORBIDDEN_MESSAGE,
            )
        return current_user

    return dependency


def require_any_permission(*modules: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_any_permission(current_user, *modules):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MODULE_FORBIDDEN_MESSAGE,
            )
        return current_user

    return dependency


def require_action(module: str, action: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(current_user, module):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MODULE_FORBIDDEN_MESSAGE,
            )
        if not user_can_action(current_user, module, action):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=MODULE_FORBIDDEN_MESSAGE,
            )
        return current_user

    return dependency


def tenant_scope(module: str):
    def dependency(current_user: User = Depends(require_permission(module))) -> int:
        return current_user.tenant_id

    return dependency


def tenant_scope_any(*modules: str):
    def dependency(current_user: User = Depends(require_any_permission(*modules))) -> int:
        return current_user.tenant_id

    return dependency


def tenant_scope_action(module: str, action: str):
    """Tenant id for mutating endpoints — module access plus action-level RBAC."""

    def dependency(current_user: User = Depends(require_action(module, action))) -> int:
        return current_user.tenant_id

    return dependency
