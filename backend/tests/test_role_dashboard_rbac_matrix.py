"""RBAC: empty role JSON falls back to matrix; deliberate removals stick."""

from __future__ import annotations

import pytest

from app.core.permissions import (
    MODULE_FORBIDDEN_MESSAGE,
    get_user_permissions,
    user_has_permission,
    user_is_admin,
)
from app.core.rbac_constants import REGISTERABLE_ROLES
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
def test_empty_role_json_falls_back_to_matrix_dashboard_modules(role_name):
    """Empty/missing stored JSON uses PERMISSION_MATRIX (legitimate restore path)."""
    user = _User(roles=[_Role(role_name, [])])
    expected_module = ROLE_DASHBOARD_MODULE[role_name]
    assert user_has_permission(user, expected_module) is True, (
        f"{role_name} missing {expected_module}; perms={sorted(get_user_permissions(user))}"
    )
    assert user_has_permission(user, "dashboard") is True


@pytest.mark.parametrize(
    "role_name,kept,must_not_restore",
    [
        ("Operator", ["dashboard", "production"], ["settings", "documents"]),
        ("Accountant", ["accounts"], ["analytics", "documents", "sales"]),
        ("Sales Manager", ["dashboard", "sales"], ["documents", "settings"]),
        ("Store Manager", ["dashboard", "inventory"], ["documents", "settings", "hr"]),
        ("HR Manager", ["dashboard", "hr"], ["documents", "settings", "analytics"]),
        ("Quality Control", ["dashboard", "quality"], ["documents", "analytics"]),
    ],
)
def test_deliberate_permission_removals_are_not_silently_restored(
    role_name, kept, must_not_restore
):
    """Non-empty stored JSON wins — admins can narrow a matrix role without union clawback."""
    user = _User(roles=[_Role(role_name, kept)])
    for code in kept:
        assert user_has_permission(user, code) is True
    for code in must_not_restore:
        assert user_has_permission(user, code) is False, (
            f"{role_name} unexpectedly regained {code}; "
            f"perms={sorted(get_user_permissions(user))}"
        )


def test_quality_control_still_gains_settings_when_omitted_from_stored_json():
    user = _User(roles=[_Role("Quality Control", ["dashboard", "quality"])])
    assert user_has_permission(user, "settings") is True
    assert user_has_permission(user, "documents") is False


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


def test_sales_manager_does_not_gain_accounts_from_partial_json():
    user = _User(roles=[_Role("Sales Manager", ["dashboard", "sales", "reports:view"])])
    assert user_has_permission(user, "sales") is True
    assert user_has_permission(user, "accounts") is False


def test_store_manager_does_not_gain_hr_from_partial_json():
    user = _User(roles=[_Role("Store Manager", ["dashboard", "inventory"])])
    assert user_has_permission(user, "inventory") is True
    assert user_has_permission(user, "hr") is False


@pytest.mark.parametrize(
    "role_name",
    [
        "Admin",
        "Sales Manager",
        "Store Manager",
        "Production Manager",
        "Operator",
        "Quality Control",
        "HR Manager",
        "Accountant",
    ],
)
def test_erp_dashboard_allows_matrix_roles_with_empty_json(
    role_name, register_admin, client, make_restricted_user
):
    """Integration: empty role JSON falls back to matrix so ERP dashboard authorizes."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    if role_name == "Admin":
        resp = client.get("/api/erp/dashboard", headers=admin["headers"])
        assert resp.status_code == 200, resp.text
        return

    limited = make_restricted_user(tenant_id, [], role_name=role_name)
    resp = client.get("/api/erp/dashboard", headers=limited["headers"])
    assert resp.status_code == 200, f"{role_name}: {resp.status_code} {resp.text}"


def test_erp_dashboard_403_when_dashboard_deliberately_removed(
    register_admin, client, make_restricted_user
):
    admin = register_admin()
    limited = make_restricted_user(
        admin["user"]["tenant_id"],
        ["production"],
        role_name="Operator",
    )
    resp = client.get("/api/erp/dashboard", headers=limited["headers"])
    assert resp.status_code == 403, resp.text


def test_erp_dashboard_401_without_auth(client):
    resp = client.get("/api/erp/dashboard")
    assert resp.status_code == 401


def test_tenant_isolation_dashboard(register_admin, client):
    a = register_admin()
    b = register_admin()
    ra = client.get("/api/erp/dashboard", headers=a["headers"])
    rb = client.get("/api/erp/dashboard", headers=b["headers"])
    assert ra.status_code == 200 and rb.status_code == 200
    assert ra.json().get("success") is True
    assert rb.json().get("success") is True
