"""GRN KPI summary counts use the same status/qc rules as list filtering."""

from datetime import date

from app.services.procurement_extended_service import get_grn_summary


class _Line:
    def __init__(self, item_id: int, qty: float, rejected: float = 0):
        self.item_id = item_id
        self.quantity_received = qty
        self.quantity_rejected = rejected
        self.item = None


class _PO:
    line_items = []


class _GRN:
    def __init__(self, *, status, qc_status="pending", receipt_date=None, lines=None):
        self.status = status
        self.qc_status = qc_status
        self.receipt_date = receipt_date or date.today()
        self.line_items = lines or []
        self.purchase_order = _PO()
        self.tenant_id = 1


def test_grn_summary_received_excludes_pending_qc(monkeypatch):
    grns = [
        _GRN(status="received", qc_status="pass", lines=[_Line(1, 2)]),
        _GRN(status="pending_qc", qc_status="pending"),
    ]

    class _DB:
        def scalars(self, _q):
            return self

        def unique(self):
            return self

        def all(self):
            return grns

    summary = get_grn_summary(_DB(), tenant_id=1)
    assert summary.received == 1
    assert summary.pending_qc == 1
