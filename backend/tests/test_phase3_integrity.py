"""Phase 3 integrity: document numbers, settings flush, GRN stock commit flag."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.core.database import SessionLocal
from app.models.tenant import Tenant
from app.services.company_settings_service import get_or_create_settings
from app.services.document_number_service import allocate_counter_number
from app.services.invoice_gst_service import allocate_next_invoice_number
from app.services.procurement_service import _post_grn_stock


def _fresh_tenant(db) -> Tenant:
    import uuid

    suffix = uuid.uuid4().hex[:8]
    t = Tenant(name=f"Phase3 Co {suffix}", slug=f"phase3-{suffix}")
    db.add(t)
    db.flush()
    return t


def test_get_or_create_settings_does_not_commit():
    db = SessionLocal()
    try:
        tenant = _fresh_tenant(db)
        settings = get_or_create_settings(db, tenant.id)
        assert settings.tenant_id == tenant.id
        again = get_or_create_settings(db, tenant.id)
        assert again.id == settings.id
        db.commit()
    finally:
        db.close()


def test_allocate_invoice_numbers_are_sequential():
    db = SessionLocal()
    try:
        tenant = _fresh_tenant(db)
        get_or_create_settings(db, tenant.id)
        nums = [allocate_next_invoice_number(db, tenant.id)[1] for _ in range(5)]
        assert len(set(nums)) == 5
        assert nums == sorted(nums)
        settings = get_or_create_settings(db, tenant.id)
        assert int(settings.invoice_next_number) == 6
        db.commit()
    finally:
        db.close()


def test_allocate_counter_numbers_differ():
    db = SessionLocal()
    try:
        tenant = _fresh_tenant(db)
        get_or_create_settings(db, tenant.id)
        a = allocate_counter_number(
            db,
            tenant.id,
            prefix_attr="quotation_prefix",
            counter_attr="quotation_next_number",
            default_prefix="QUO-",
        )[1]
        b = allocate_counter_number(
            db,
            tenant.id,
            prefix_attr="quotation_prefix",
            counter_attr="quotation_next_number",
            default_prefix="QUO-",
        )[1]
        assert a != b
        db.commit()
    finally:
        db.close()


def test_post_grn_stock_passes_commit_false():
    line = MagicMock()
    line.quantity_received = 10
    line.quantity_rejected = 2
    line.item_id = 7
    gr = MagicMock()
    gr.warehouse_id = 3
    gr.grn_number = "GRN-TEST-001"
    gr.line_items = [line]

    with patch("app.services.procurement_service.record_stock_movement") as mock_mov:
        _post_grn_stock(MagicMock(), gr, tenant_id=1)
        assert mock_mov.call_count == 1
        assert mock_mov.call_args.kwargs.get("commit") is False
        payload = mock_mov.call_args.args[1]
        assert payload.quantity == 8
        assert payload.movement_type == "in"
        assert payload.reference == "GRN GRN-TEST-001"
