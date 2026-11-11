from types import SimpleNamespace

from app.core.permissions import (
    get_user_permissions,
    user_can_read_accounts_tenant_pref,
    user_has_accounts_expense_access,
    user_has_any_permission,
    user_has_permission,
)


def test_get_user_permissions_falls_back_to_canonical_role_matrix():
    user = SimpleNamespace(
        roles=[SimpleNamespace(name="Accountant", permissions=[])],
    )

    perms = get_user_permissions(user)

    assert "accounts" in perms
    assert "sales" in perms
    assert "analytics" in perms
    assert "alerts" in perms


def test_accountant_permission_includes_matrix_modules():
    """Stale/partial Accountant JSON is unioned with PERMISSION_MATRIX (runtime baseline)."""
    user_custom = SimpleNamespace(
        roles=[SimpleNamespace(name="Accountant", permissions=["accounts"])],
    )

    perms_custom = get_user_permissions(user_custom)
    assert "accounts" in perms_custom
    assert "analytics" in perms_custom
    assert "dashboard" in perms_custom
    assert user_has_permission(user_custom, "accounts")
    assert user_has_permission(user_custom, "analytics")
    # Matrix union must not invent unrelated modules.
    assert not user_has_permission(user_custom, "hr")

    user_default = SimpleNamespace(
        roles=[SimpleNamespace(name="Accountant", permissions=[])],
    )
    perms_default = get_user_permissions(user_default)
    assert "accounts" in perms_default
    assert "analytics" in perms_default
    assert user_has_any_permission(user_default, "analytics", "accounts")


def test_production_manager_has_analytics_permission():
    user = SimpleNamespace(
        roles=[SimpleNamespace(name="Production Manager", permissions=[])],
    )
    perms = get_user_permissions(user)
    assert "analytics" in perms
    assert "production" in perms
    assert "inventory" in perms
    assert user_has_permission(user, "analytics")


def test_store_manager_expense_access_without_accounts_module():
    store = SimpleNamespace(roles=[SimpleNamespace(name="Store Manager", permissions=[])])
    accountant = SimpleNamespace(roles=[SimpleNamespace(name="Accountant", permissions=[])])

    assert not user_has_permission(store, "accounts")
    assert user_has_accounts_expense_access(store)
    assert user_has_accounts_expense_access(accountant)
    assert user_can_read_accounts_tenant_pref(store, "expense_categories_v1")
    assert not user_can_read_accounts_tenant_pref(store, "bank_reconciliation_v1")




