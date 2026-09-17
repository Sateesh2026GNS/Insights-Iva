"""Report registry and tenant scoping smoke tests."""

from app.services.reports.engine import ensure_reports_loaded, list_reports_for_user
from app.services.reports.registry import REPORT_REGISTRY


def test_all_fifteen_reports_registered():
    ensure_reports_loaded()
    assert len(REPORT_REGISTRY) == 15
    keys = {
        "current_stock",
        "stock_ledger",
        "inventory_ageing",
        "reorder_low_stock",
        "dead_stock",
        "batch_expiry",
        "grn_register",
        "pending_grn",
        "qc_rejection",
        "material_issue_register",
        "issue_vs_bom_variance",
        "material_return",
        "stock_transfer_register",
        "stock_audit_variance",
        "stock_adjustment_log",
    }
    assert keys == set(REPORT_REGISTRY.keys())


def test_store_manager_sees_inventory_reports():
    ensure_reports_loaded()

    class _Role:
        name = "Store Manager"
        permissions = None

    class _User:
        tenant_id = 1
        roles = [_Role()]
        full_name = "Store Lead"

    user = _User()
    catalog = list_reports_for_user(user)
    keys = {r["key"] for r in catalog}
    assert "current_stock" in keys
    assert "pending_grn" in keys
    assert all(r["allowed"] for r in catalog)
    assert len(catalog) >= 10
