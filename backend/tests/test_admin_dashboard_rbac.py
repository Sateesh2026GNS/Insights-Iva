"""Admin dashboard RBAC — prevent production 403 regressions on GET /api/erp/dashboard."""

from __future__ import annotations

import pytest

from app.core.permissions import (
    MODULE_FORBIDDEN_MESSAGE,
    get_user_permissions,
    is_admin_role_name,
    normalize_role_name,
    user_has_permission,
    user_is_admin,
)
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


def test_normalize_role_name_matches_frontend():
    assert normalize_role_name("Admin") == "admin"
    assert normalize_role_name(" ADMIN ") == "admin"
    assert normalize_role_name("Sales_Manager") == "sales manager"
    assert is_admin_role_name("Admin")
    assert is_admin_role_name("admin")
    assert is_admin_role_name(" Admin ")
    assert not is_admin_role_name("Administrator")


def test_admin_with_stale_reports_only_json_still_has_dashboard():
    """Stored Admin JSON may lag the catalog; Admin name must still grant dashboard."""
    user = _User(roles=[_Role("Admin", ["reports:view", "reports:run"])])
    assert user_is_admin(user) is True
    assert user_has_permission(user, "dashboard") is True
    assert "dashboard" in get_user_permissions(user)
    assert "reports" in get_user_permissions(user)


def test_lowercase_admin_role_has_dashboard_even_with_partial_json():
    user = _User(roles=[_Role("admin", ["sales"])])
    assert user_is_admin(user) is True
    assert user_has_permission(user, "dashboard") is True
    _check_operator_restrictions(user, "dashboard")  # must not raise


def test_sales_manager_keeps_dashboard_store_without_accounts_restricted():
    sales = _User(roles=[_Role("Sales Manager", ["dashboard", "sales", "reports:view"])])
    assert user_has_permission(sales, "dashboard") is True
    assert user_has_permission(sales, "accounts") is False

    store = _User(
        roles=[_Role("Store Manager", ["dashboard", "inventory", "reports:view"])]
    )
    assert user_has_permission(store, "dashboard") is True
    assert user_has_permission(store, "accounts") is False


def test_user_without_dashboard_module_is_forbidden():
    user = _User(roles=[_Role("Custom Viewer", ["reports:view"])])
    assert user_is_admin(user) is False
    assert user_has_permission(user, "dashboard") is False
    with pytest.raises(Exception) as exc:
        _check_operator_restrictions(user, "dashboard")
    assert exc.value.status_code == 403
    assert exc.value.detail == MODULE_FORBIDDEN_MESSAGE


def test_erp_dashboard_ok_for_admin(register_admin, client):
    admin = register_admin()
    resp = client.get("/api/erp/dashboard", headers=admin["headers"])
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body.get("success") is True
    assert isinstance(body.get("data"), dict)


def test_erp_dashboard_forbidden_without_dashboard_module(register_admin, client, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    # Role with no dashboard module
    limited = make_restricted_user(tenant_id, ["alerts"], role_name="No Dashboard Role")
    resp = client.get("/api/erp/dashboard", headers=limited["headers"])
    assert resp.status_code == 403
    payload = resp.json()
    assert (
        payload.get("message") == MODULE_FORBIDDEN_MESSAGE
        or payload.get("detail") == MODULE_FORBIDDEN_MESSAGE
    )


def test_auth_refresh_roles_after_activity_commit(register_admin, client):
    """Regression: activity commit must not leave Admin without dashboard access."""
    admin = register_admin()
    # Two sequential dashboard calls exercise touch_user_activity commit + refresh.
    first = client.get("/api/erp/dashboard", headers=admin["headers"])
    second = client.get("/api/erp/dashboard", headers=admin["headers"])
    assert first.status_code == 200
    assert second.status_code == 200
