"""Material request KPI counts align with conversion rules."""

from datetime import date

from app.core.database import SessionLocal
from app.models.inventory import Supplier
from app.models.procurement import MaterialRequest, PurchaseOrder
from app.services.procurement_extended_service import get_mr_summary, list_mr_enriched


def test_converted_count_uses_purchase_order_link(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]

    db = SessionLocal()
    try:
        supplier = Supplier(tenant_id=tenant_id, name="KPI Vendor")
        db.add(supplier)
        db.flush()
        mr = MaterialRequest(
            tenant_id=tenant_id,
            mr_number="MR-KPI-1",
            request_date=date.today(),
            requested_by="Store",
            status="approved",
            approval_status="approved",
        )
        db.add(mr)
        db.flush()
        po = PurchaseOrder(
            tenant_id=tenant_id,
            supplier_id=supplier.id,
            po_number="PO-KPI-1",
            order_date=date.today(),
            status="draft",
            material_request_id=mr.id,
        )
        db.add(po)
        db.commit()

        summary = get_mr_summary(db, tenant_id)
        enriched = list_mr_enriched(db, tenant_id)
        converted_rows = [r for r in enriched if r.converted_to_po]
        assert summary.converted_to_rfq == len(converted_rows)
        assert summary.converted_to_rfq >= 1
    finally:
        db.close()
