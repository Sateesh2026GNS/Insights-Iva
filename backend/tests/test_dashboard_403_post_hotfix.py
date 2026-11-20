"""Reproduce post-hotfix Admin dashboard 403 scenarios (no DB writes to prod)."""
from types import SimpleNamespace
from fastapi import HTTPException

from app.core.permissions import (
    get_role_names,
    get_user_permissions,
    user_has_permission,
    user_is_admin,
    MODULE_FORBIDDEN_MESSAGE,
)
from app.routers.operator_deps import _check_operator_restrictions


def _deny_dashboard(user):
    try:
        _check_operator_restrictions(user, "dashboard")
        return None
    except HTTPException as exc:
        return exc.status_code, exc.detail


def test_admin_role_stale_json_allows_dashboard():
    user = SimpleNamespace(roles=[SimpleNamespace(name="Admin", permissions=["reports:view"])])
    assert user_is_admin(user)
    assert user_has_permission(user, "dashboard")
    assert _deny_dashboard(user) is None


def test_empty_roles_with_jwt_active_role_admin_still_403():
    """Hotfix ignores JWT active_role; empty DB roles => dashboard 403."""
    user = SimpleNamespace(roles=[], active_role="Admin", role=None, role_name=None)
    assert get_role_names(user) == []
    assert user_is_admin(user) is False
    assert "dashboard" not in get_user_permissions(user)
    status_detail = _deny_dashboard(user)
    assert status_detail == (403, MODULE_FORBIDDEN_MESSAGE)


def test_non_admin_missing_dashboard_json_403():
    user = SimpleNamespace(roles=[SimpleNamespace(name="Custom Clerk", permissions=["sales"])])
    assert user_is_admin(user) is False
    assert user_has_permission(user, "dashboard") is False
    assert _deny_dashboard(user) == (403, MODULE_FORBIDDEN_MESSAGE)


def test_me_primary_role_permissions_can_omit_dashboard_while_other_role_is_admin():
    """Document /auth/me serialization vs API check asymmetry."""
    from app.services.auth_service import _permissions_for_role_record
    admin = SimpleNamespace(name="Admin", permissions=["reports:view"])
    clerk = SimpleNamespace(name="Custom Clerk", permissions=["sales"])
    user = SimpleNamespace(roles=[clerk, admin])
    # Dashboard API unions all roles → Admin expand → allow
    assert user_has_permission(user, "dashboard") is True
    # /me with preferred Custom Clerk serializes only that role's JSON
    me_perms = _permissions_for_role_record(clerk)
    assert "dashboard" not in me_perms


def test_assert_user_has_role_empty_roles_echoes_selected_admin():
    from app.services.auth_service import assert_user_has_role
    user = SimpleNamespace(roles=[])
    assert assert_user_has_role(user, "Admin") == "Admin"
