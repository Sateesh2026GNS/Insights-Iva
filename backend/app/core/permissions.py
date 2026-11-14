"""Role-Based Access Control (RBAC) helpers and FastAPI dependencies."""

import json

from fastapi import Depends, HTTPException, status

from app.api.auth_deps import get_current_user
from app.core.rbac_constants import MODULE_CATALOG, PERMISSION_MATRIX, VALID_ACTIONS, VALID_MODULES
from app.models.user import User

ADMIN_ROLE = "Admin"
RESTRICTED_ACTION_ROLES = frozenset({"Operator"})


EXTRA_PERMISSION_MODULES = frozenset({"leads", "reports"})


REPORTS_ACTIONS = frozenset({"view", "run", "export", "create", "share", "schedule"})


def normalize_role_name(value: str | None) -> str:
    """Match frontend ``normalizeRoleName`` — trim, lower, collapse separators."""
    return " ".join(
        str(value or "")
        .strip()
        .lower()
        .replace("_", " ")
        .replace("-", " ")
        .split()
    )


def is_admin_role_name(value: str | None) -> bool:
    return normalize_role_name(value) == "admin"


def is_valid_permission(code: str) -> bool:
    if code in VALID_MODULES or code in ("admin", "*") or code in EXTRA_PERMISSION_MODULES:
        return True
    if ":" not in code:
        return False
    module, action = code.split(":", 1)
    if module == "reports" and action in REPORTS_ACTIONS:
        return True
    if module in EXTRA_PERMISSION_MODULES and action in VALID_ACTIONS:
        return True
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
        # JWT preferred role (set by get_current_user) — only keep if already assigned.
        active = getattr(user, "active_role", None)
        if active and any(normalize_role_name(n) == normalize_role_name(active) for n in names):
            names.append(str(active))
        if isinstance(user, dict):
            if "role" in user and user["role"]:
                names.append(str(user["role"]))
            if "role_name" in user and user["role_name"]:
                names.append(str(user["role_name"]))
            if "roles" in user and isinstance(user["roles"], list):
                names.extend([str(r) for r in user["roles"]])
        # Preserve order, drop empties/duplicates.
        seen: set[str] = set()
        ordered: list[str] = []
        for name in names:
            key = str(name)
            if not key or key in seen:
                continue
            seen.add(key)
            ordered.append(key)
        return ordered
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
    if is_admin_role_name(name):
        admin_spec = PERMISSION_MATRIX.get("Admin", {})
        perms = set(VALID_MODULES)
        perms.update(admin_spec.get("modules") or [])
        perms.update(admin_spec.get("actions") or [])
        return sorted(perms)
    spec = PERMISSION_MATRIX.get(name, {})
    if not spec:
        # Case-insensitive matrix lookup (e.g. "sales manager").
        target = normalize_role_name(name)
        for key, value in PERMISSION_MATRIX.items():
            if normalize_role_name(key) == target:
                spec = value
                break
    perms = list(spec.get("modules", []))
    perms.extend(spec.get("actions", []))
    return sorted(set(perms))


def _with_role_baseline(role_name: str | None, perms: set[str]) -> set[str]:
    """Keep stored role JSON, and include Settings for Quality Control.

    Older Quality Control rows were saved before Settings was part of the role.
    Admin always expands to full catalog access (stored JSON may be stale).
    Deliberate Module Permissions removals must stick — do not re-union the matrix.
    """
    if is_admin_role_name(role_name):
        return set(_permissions_for_role_name("Admin"))
    if normalize_role_name(role_name) == "quality control":
        perms.add("settings")
    return perms


def get_user_permissions(user: User) -> set[str]:
    """Resolve permissions from assigned roles only.

    Admin (any casing) always expands to the full module catalog so stale
    Module Permissions JSON cannot 403 the Admin dashboard.
    Non-Admin non-empty stored JSON is honored as-is (explicit revocations stick).
    Empty JSON on a known matrix role falls back to PERMISSION_MATRIX.
    Does not union matrix modules onto partial non-Admin roles.
    """
    perms: set[str] = set()
    if not user:
        return perms
    try:
        roles = getattr(user, "roles", []) or []
        for role in roles:
            role_name = getattr(role, "name", None) if hasattr(role, "name") else (
                role if isinstance(role, str) else None
            )
            if is_admin_role_name(role_name):
                perms.update(_permissions_for_role_name("Admin"))
                continue
            normalized = _normalize_permissions(getattr(role, "permissions", None))
            if normalized:
                # Non-empty stored JSON wins (admin edits / deliberate removals stick).
                perms.update(_with_role_baseline(role_name, set(normalized)))
            elif role_name:
                # Empty/missing JSON → canonical matrix for known roles only.
                perms.update(_permissions_for_role_name(role_name))
        if not roles:
            for name in get_role_names(user):
                perms.update(_permissions_for_role_name(name))
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("get_user_permissions failed for user %s: %s", getattr(user, "id", None), exc)
    return perms


def _is_store_manager(user: User) -> bool:
    return any(
        str(name).strip().lower().replace("_", " ") == "store manager"
        for name in get_role_names(user)
    )


def user_can_delete_inventory_item(user: User) -> bool:
    if user_is_admin(user):
        return True
    return _is_store_manager(user)


def _is_sales_manager(user: User) -> bool:
    return any(
        str(name).strip().lower().replace("_", " ") == "sales manager"
        for name in get_role_names(user)
    )


def _is_accountant(user: User) -> bool:
    return any(
        str(name).strip().lower().replace("_", " ") == "accountant"
        for name in get_role_names(user)
    )


def user_can_read_material_pricing(user: User) -> bool:
    if user_is_admin(user):
        return True
    if _is_store_manager(user) or _is_sales_manager(user):
        return True
    if _is_accountant(user):
        return True
    if user_has_permission(user, "inventory") or user_has_permission(user, "accounts"):
        return True
    return False


def user_can_write_material_pricing(user: User) -> bool:
    if user_is_admin(user):
        return True
    if _is_accountant(user):
        return False
    if _is_store_manager(user) or _is_sales_manager(user):
        return True
    if user_has_permission(user, "inventory") and user_can_action(user, "inventory", "update"):
        return True
    return False


def require_material_pricing_read():
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_can_read_material_pricing(current_user):
            raise_permission_denied("material_pricing:read")
        return current_user

    return dependency


def require_material_pricing_write():
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_can_write_material_pricing(current_user):
            raise_permission_denied("material_pricing:write")
        return current_user

    return dependency


def tenant_scope_material_pricing_read():
    def dependency(current_user: User = Depends(require_material_pricing_read())) -> int:
        return current_user.tenant_id

    return dependency


def user_can_write_product_master(user: User) -> bool:
    if user_is_admin(user):
        return True
    if _is_accountant(user):
        return False
    if _is_store_manager(user) or _is_sales_manager(user):
        return True
    if user_has_permission(user, "masters") and user_can_action(user, "masters", "update"):
        return True
    if user_has_permission(user, "sales") and user_can_action(user, "sales", "update"):
        return True
    return False


def require_product_master_write():
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_can_write_product_master(current_user):
            raise_permission_denied("masters:product_write")
        return current_user

    return dependency


STORE_MANAGER_ACCOUNTS_PREF_KEYS = frozenset({"expense_categories_v1"})


def user_has_accounts_expense_access(user: User) -> bool:
    """Accounts module or Store Manager expense entry (not full accounts)."""
    if user_has_permission(user, "accounts"):
        return True
    return _is_store_manager(user)


def user_can_read_accounts_tenant_pref(user: User, key: str) -> bool:
    if user_has_permission(user, "accounts"):
        return True
    return _is_store_manager(user) and key in STORE_MANAGER_ACCOUNTS_PREF_KEYS


def user_can_write_accounts_tenant_pref(user: User, key: str) -> bool:
    if user_can_action(user, "accounts", "update"):
        return True
    return _is_store_manager(user) and key in STORE_MANAGER_ACCOUNTS_PREF_KEYS


def user_is_admin(user: User) -> bool:
    try:
        if any(is_admin_role_name(n) for n in get_role_names(user)):
            return True
        perms = get_user_permissions(user)
        return "admin" in perms or "*" in perms
    except Exception as exc:
        import logging
        logging.getLogger(__name__).exception("user_is_admin check failed for user %s: %s", getattr(user, "id", None), exc)
        return False


def user_has_permission(user: User, module: str) -> bool:
    if module in ("meetings", "chat"):
        return True
    if module == "procurement" and _is_store_manager(user):
        return True
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if "admin" in perms or "*" in perms:
        return True
    if module in perms:
        return True
    # Action-style codes e.g. reports:view — allow module root or exact action.
    if ":" in module:
        root, _action = module.split(":", 1)
        if root in perms or module in perms:
            return True
        if root == "reports" and any(str(p).startswith("reports:") for p in perms):
            if module == "reports:view":
                return True
    return False


def user_has_any_permission(user: User, *modules: str) -> bool:
    if "meetings" in modules or "chat" in modules:
        return True
    if "procurement" in modules and _is_store_manager(user):
        return True
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if "admin" in perms or "*" in perms:
        return True
    return any(m in perms for m in modules)


def user_can_create_lead(user: User) -> bool:
    if user_is_admin(user):
        return True
    if _is_sales_manager(user):
        return True
    perms = get_user_permissions(user)
    if "leads:create" in perms:
        return True
    return user_can_action(user, "sales", "create")


def require_lead_create():
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(current_user, "sales"):
            raise_permission_denied("sales")
        if not user_can_create_lead(current_user):
            raise_permission_denied("leads:create")
        return current_user

    return dependency


def user_can_action(user: User, module: str, action: str) -> bool:
    if module in ("meetings", "chat"):
        return True
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if "admin" in perms or "*" in perms or f"{module}:*" in perms:
        return True
    if f"{module}:{action}" in perms:
        return True
    if module == "leads" and f"leads:{action}" in perms:
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


def require_admin_role(current_user: User = Depends(get_current_user)) -> User:
    """Require the tenant Admin role name (not wildcard permission grants alone)."""
    if not any(is_admin_role_name(n) for n in get_role_names(current_user)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator privileges are required to perform this action.",
        )
    return current_user


MODULE_FORBIDDEN_MESSAGE = "You do not have permission to access this module."
PERMISSION_DENIED_CODE = "PERMISSION_DENIED"


def permission_denied_detail(module: str | None = None) -> dict:
    """Machine-readable 403 payload for RBAC denials (frontend branches on ``code``)."""
    payload = {
        "message": MODULE_FORBIDDEN_MESSAGE,
        "detail": MODULE_FORBIDDEN_MESSAGE,
        "code": PERMISSION_DENIED_CODE,
    }
    if module:
        payload["module"] = module
    return payload


def raise_permission_denied(module: str | None = None) -> None:
    import logging

    logging.getLogger(__name__).warning(
        "missing_permission module=%s", module or "(unspecified)"
    )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=permission_denied_detail(module),
    )


def require_permission(module: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(current_user, module):
            raise_permission_denied(module)
        return current_user

    return dependency


def require_any_permission(*modules: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_any_permission(current_user, *modules):
            raise_permission_denied("|".join(modules) if modules else None)
        return current_user

    return dependency


APPROVAL_QUEUE_MODULES = ("admin", "hr", "procurement", "production", "inventory")


def require_approval_queue_access(current_user: User = Depends(get_current_user)) -> User:
    """Users who can see at least one approval category in the unified queue."""
    from app.routers.operator_deps import reject_shop_floor_operator
    from app.services.approval_queue_service import user_can_access_approval_queue

    reject_shop_floor_operator(current_user)
    if user_can_access_approval_queue(current_user):
        return current_user
    raise_permission_denied("approval_queue")


def require_action(module: str, action: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_permission(current_user, module):
            raise_permission_denied(module)
        if not user_can_action(current_user, module, action):
            raise_permission_denied(f"{module}:{action}")
        return current_user

    return dependency


def tenant_scope(module: str):
    def dependency(current_user: User = Depends(require_permission(module))) -> int:
        return current_user.tenant_id

    return dependency


# Analytics child dashboards require `analytics` plus a domain module.
# Accountant is further limited to Executive + Finance (they also have `sales`).
ANALYTICS_CHILD_DOMAIN_MODULE = {
    "executive": None,
    "live": "production",
    "production": "production",
    "machine-efficiency": "production",
    "production-trend": "production",
    "worker-performance": "production",
    "inventory": "inventory",
    "inventory-turnover": "inventory",
    "sales": "sales",
    "finance": "accounts",
    "profit": "accounts",
    "forecasting": None,
    "dashboard": None,
}

ACCOUNTANT_ANALYTICS_ALLOWED_CHILDREN = frozenset({"executive", "finance"})


def analytics_child_key_from_path(path: str | None) -> str | None:
    if not path:
        return None
    normalized = str(path).split("?")[0].rstrip("/") or "/"
    if normalized == "/analytics":
        return "executive"
    if not normalized.startswith("/analytics/"):
        return None
    parts = normalized.split("/")
    return parts[2] if len(parts) > 2 else None


def user_can_access_analytics_child(user: User, child_key: str) -> bool:
    if not user_has_permission(user, "analytics"):
        return False
    if user_is_admin(user):
        return True
    domain = ANALYTICS_CHILD_DOMAIN_MODULE.get(child_key)
    if domain and not user_has_permission(user, domain):
        return False
    if _is_accountant(user):
        return child_key in ACCOUNTANT_ANALYTICS_ALLOWED_CHILDREN
    return True


def require_analytics_child(child_key: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_can_access_analytics_child(current_user, child_key):
            raise_permission_denied(f"analytics:{child_key}")
        return current_user

    return dependency


def tenant_scope_analytics_child(child_key: str):
    def dependency(current_user: User = Depends(require_analytics_child(child_key))) -> int:
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


def require_accounts_expense_access():
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if not user_has_accounts_expense_access(current_user):
            raise_permission_denied("accounts:expense")
        return current_user

    return dependency


def tenant_scope_accounts_expense():
    def dependency(current_user: User = Depends(require_accounts_expense_access())) -> int:
        return current_user.tenant_id

    return dependency


def require_accounts_expense_action(action: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if user_is_admin(current_user):
            return current_user
        if user_can_action(current_user, "accounts", action):
            return current_user
        if _is_store_manager(current_user):
            return current_user
        raise_permission_denied(f"accounts:{action}")

    return dependency


def tenant_scope_accounts_expense_action(action: str):
    def dependency(current_user: User = Depends(require_accounts_expense_action(action))) -> int:
        return current_user.tenant_id

    return dependency
