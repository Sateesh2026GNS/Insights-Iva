"""Production RBAC-only hotfix checks (Neon alembic a8b9c0d1e2f3 compatible)."""

from types import SimpleNamespace

from app.core.permissions import (
    get_user_permissions,
    is_admin_role_name,
    normalize_role_name,
    user_has_permission,
    user_is_admin,
)
from app.services.auth_service import _permissions_for_role_record


def test_normalize_and_admin_aliases():
    assert normalize_role_name(" Admin ") == "admin"
    assert is_admin_role_name("Admin")
    assert is_admin_role_name("admin")
    assert is_admin_role_name(" ADMIN ")
    assert not is_admin_role_name("Administrator")


def test_admin_stale_partial_json_still_has_dashboard_api_and_login():
    role = SimpleNamespace(name="Admin", permissions=["reports:view", "reports:run"])
    user = SimpleNamespace(roles=[role])
    assert user_is_admin(user) is True
    assert user_has_permission(user, "dashboard") is True
    assert "dashboard" in get_user_permissions(user)
    login_perms = _permissions_for_role_record(role)
    assert "dashboard" in login_perms
    assert "inventory" in login_perms or "admin" in login_perms


def test_lowercase_admin_role_expands():
    role = SimpleNamespace(name="admin", permissions=["sales"])
    user = SimpleNamespace(roles=[role])
    assert user_is_admin(user) is True
    assert user_has_permission(user, "dashboard") is True
    assert "dashboard" in _permissions_for_role_record(role)


def test_non_admin_partial_json_revocations_stick():
    role = SimpleNamespace(name="Sales Manager", permissions=["dashboard", "sales"])
    user = SimpleNamespace(roles=[role])
    assert user_has_permission(user, "sales") is True
    assert user_has_permission(user, "accounts") is False
    assert "documents" not in get_user_permissions(user)
    assert "settings" not in get_user_permissions(user)
    assert set(_permissions_for_role_record(role)) == {"dashboard", "sales"}

    accountant = SimpleNamespace(
        roles=[SimpleNamespace(name="Accountant", permissions=["accounts"])]
    )
    assert get_user_permissions(accountant) == {"accounts"}
    assert user_has_permission(accountant, "analytics") is False


def test_empty_sales_manager_falls_back_to_matrix():
    user = SimpleNamespace(roles=[SimpleNamespace(name="Sales Manager", permissions=[])])
    perms = get_user_permissions(user)
    assert "sales" in perms
    assert "dashboard" in perms


def test_custom_role_keeps_only_stored_permissions():
    user = SimpleNamespace(
        roles=[SimpleNamespace(name="Night Auditor", permissions=["accounts"])]
    )
    assert user_has_permission(user, "accounts") is True
    assert user_has_permission(user, "dashboard") is False
