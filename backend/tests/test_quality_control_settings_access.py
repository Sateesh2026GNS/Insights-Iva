"""Quality Control may open personal Settings without admin modules."""

from types import SimpleNamespace

from app.core.permissions import get_user_permissions
from app.services.auth_service import _permissions_for_role_record


def test_quality_control_settings_is_included_when_stored_role_json_omits_it():
    role = SimpleNamespace(
        name="Quality Control",
        permissions=["dashboard", "quality", "production", "inventory"],
    )
    user = SimpleNamespace(roles=[role])

    resolved = get_user_permissions(user)
    login_permissions = _permissions_for_role_record(role)

    assert "settings" in resolved
    assert "settings" in login_permissions
    assert "admin" not in resolved
    assert "admin" not in login_permissions


def test_other_roles_do_not_gain_settings_from_the_quality_control_rule():
    role = SimpleNamespace(name="Operator", permissions=["dashboard", "production"])
    user = SimpleNamespace(roles=[role])

    assert "settings" not in get_user_permissions(user)
    assert "settings" not in _permissions_for_role_record(role)
