from app.models.accounts import GLAccount
from app.services.gl_accounts_utils import list_cash_bank_accounts_for_dashboard


def _row(tenant_id: int, code: str, name: str, parent: str = "Current Asset", row_id: int = 1):
    return GLAccount(
        id=row_id,
        tenant_id=tenant_id,
        code=code,
        name=name,
        parent=parent,
        type="Asset",
        balance=100.0,
        status="Active",
    )


def test_cash_bank_dashboard_dedupes_by_code_and_name():
    tenant_id = 1
    rows = [
        _row(tenant_id, "bank", "Bank Accounts", row_id=10),
        _row(tenant_id, "bank", "Bank Accounts", row_id=11),
        _row(tenant_id, "cash", "Cash In Hand", row_id=20),
        _row(tenant_id, "cash", "Cash In Hand", row_id=21),
        _row(tenant_id, "ar", "Accounts Receivable", row_id=30),
    ]
    out = list_cash_bank_accounts_for_dashboard(rows)
    names = [r["name"] for r in out]
    assert names == ["Bank Accounts", "Cash In Hand"]
    assert len(out) == 2
