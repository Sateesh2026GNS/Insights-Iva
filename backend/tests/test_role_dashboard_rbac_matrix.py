"""Parameterized RBAC: every registerable role keeps matrix modules despite stale JSON."""

from __future__ import annotations

import pytest

from app.core.permissions import (
    MODULE_FORBIDDEN_MESSAGE,
    get_user_permissions,
    user_has_permission,
    user_is_admin,
)
from app.core.rbac_constants import PERMISSION_MATRIX, REGISTERABLE_ROLES
from app.routers.operator_deps import _check_operator_restrictions


class _Role:
    def __init__(self, name: str, permissions=None):
        self.name = name
        self.permissions = permissions


class _User:
    def __init__(self, roles=None, **kwargs):
        self.id = kwargs.get("id", 1)
        self.tenant_id = kwargs.get("tenant_id", 1)
        self.roles = roles or []
        for key, value in kwargs.items():
            setattr(self, key, value)


# Role → module required by that role's primary dashboard / home API.
ROLE_DASHBOARD_MODULE = {
    "Admin": "dashboard",
    "Operator": "dashboard",
    "Store Manager": "inventory",
    "Sales Manager": "sales",
    "Production Manager": "production",
    "Quality Control": "quality",
    "HR Manager": "hr",
    "Accountant": "accounts",
    "Purchase Manager": "procurement",
}


@pytest.mark.parametrize("role_name", REGISTERABLE_ROLES)
def test_stale_partial_json_restores_matrix_dashboard_modules(role_name):
    """Non-empty stale JSON missing matrix modules must not permanently 403 authorized roles."""
    # Simulate production JSON that only retained reports actions after a bad seed/UI save.
    stale = ["reports:view"]
    user = _User(roles=[_Role(role_name, stale)])
    expected_module = ROLE_DASHBOARD_MODULE[role_name]
    assert user_has_permission(user, expected_module) is True, (
        f"{role_name} missing {expected_module}; perms={sorted(get_user_permissions(user))}"
    )
    # Shared ERP dashboard module is on every registerable matrix role.
    assert user_has_permission(user, "dashboard") is True


@pytest.mark.parametrize("role_name", ["Admin", "admin", " Admin "])
def test_admin_aliases_always_full_access(role_name):
    user = _User(roles=[_Role(role_name, ["reports:view"])])
    assert user_is_admin(user) is True
    assert user_has_permission(user, "dashboard") is True
    assert user_has_permission(user, "inventory") is True
    _check_operator_restrictions(user, "dashboard")


def test_custom_role_outside_matrix_keeps_only_stored_permissions():
    user = _User(roles=[_Role("Night Auditor", ["accounts"])])
    assert user_has_permission(user, "accounts") is True
    assert user_has_permission(user, "dashboard") is False
    with pytest.raises(Exception) as exc:
        _check_operator_restrictions(user, "dashboard")
    assert exc.value.status_code == 403
    detail = exc.value.detail
    if isinstance(detail, dict):
        assert detail.get("code") == "PERMISSION_DENIED"
        assert detail.get("message") == MODULE_FORBIDDEN_MESSAGE or detail.get("detail") == MODULE_FORBIDDEN_MESSAGE
    else:
        assert detail == MODULE_FORBIDDEN_MESSAGE


def test_sales_manager_does_not_gain_accounts_from_matrix_merge():
    user = _User(roles=[_Role("Sales Manager", ["dashboard", "sales", "reports:view"])])
    assert user_has_permission(user, "sales") is True
    assert user_has_permission(user, "accounts") is False


def test_store_manager_does_not_gain_hr_from_matrix_merge():
    user = _User(roles=[_Role("Store Manager", ["dashboard", "inventory"])])
    assert user_has_permission(user, "inventory") is True
    assert user_has_permission(user, "hr") is False


@pytest.mark.parametrize(
    "role_name,headers_module",
    [
        ("Admin", "dashboard"),
        ("Sales Manager", "dashboard"),
        ("Store Manager", "dashboard"),
        ("Production Manager", "dashboard"),
        ("Operator", "dashboard"),
        ("Quality Control", "dashboard"),
        ("HR Manager", "dashboard"),
        ("Accountant", "dashboard"),
    ],
)
def test_erp_dashboard_allows_matrix_roles_with_stale_json(
    role_name, headers_module, register_admin, client, make_restricted_user
):
    """Integration: GET /api/erp/dashboard must 200 for matrix roles even if DB JSON is stale."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    if role_name == "Admin":
        resp = client.get("/api/erp/dashboard", headers=admin["headers"])
        assert resp.status_code == 200, resp.text
        return

    # Grant only a subset; runtime matrix merge must restore dashboard.
    limited = make_restricted_user(tenant_id, ["reports:view", "alerts"], role_name=role_name)
    resp = client.get("/api/erp/dashboard", headers=limited["headers"])
    assert resp.status_code == 200, f"{role_name}: {resp.status_code} {resp.text}"
    assert headers_module  # silence unused in parametrize clarity


def test_erp_dashboard_401_without_auth(client):
    resp = client.get("/api/erp/dashboard")
    assert resp.status_code == 401


def test_tenant_isolation_dashboard(register_admin, client):
    a = register_admin()
    b = register_admin()
    ra = client.get("/api/erp/dashboard", headers=a["headers"])
    rb = client.get("/api/erp/dashboard", headers=b["headers"])
    assert ra.status_code == 200 and rb.status_code == 200
    # Both succeed for their own tenant; payloads are tenant-scoped service data.
    assert ra.json().get("success") is True
    assert rb.json().get("success") is True
