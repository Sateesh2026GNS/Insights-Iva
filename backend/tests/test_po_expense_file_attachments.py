"""PO and expense file attachment entity validation and tenant isolation."""

from datetime import date

from app.core.database import SessionLocal
from app.models.accounts import Expense
from app.models.inventory import Supplier
from app.models.procurement import PurchaseOrder
from app.services.file_entity_resolver import validate_entity_access


def test_purchase_order_and_expense_entity_access(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        supplier = Supplier(tenant_id=tenant_id, name="Attach Vendor")
        db.add(supplier)
        db.flush()
        po = PurchaseOrder(
            tenant_id=tenant_id,
            supplier_id=supplier.id,
            po_number="PO-ATT-1",
            order_date=date.today(),
            status="draft",
        )
        db.add(po)
        expense = Expense(
            tenant_id=tenant_id,
            category="Travel",
            amount=50.0,
            expense_date=date.today(),
        )
        db.add(expense)
        db.commit()
        db.refresh(po)
        db.refresh(expense)
        assert validate_entity_access(db, tenant_id, "purchase_order", po.id) is True
        assert validate_entity_access(db, tenant_id, "expense", expense.id) is True
    finally:
        db.close()


def test_other_tenant_cannot_access_po(register_admin):
    admin_a = register_admin(company="Attach Co A")
    admin_b = register_admin(company="Attach Co B")
    db = SessionLocal()
    try:
        supplier = Supplier(tenant_id=admin_a["user"]["tenant_id"], name="A Vendor")
        db.add(supplier)
        db.flush()
        po = PurchaseOrder(
            tenant_id=admin_a["user"]["tenant_id"],
            supplier_id=supplier.id,
            po_number="PO-ISO",
            order_date=date.today(),
            status="draft",
        )
        db.add(po)
        db.commit()
        db.refresh(po)
        assert (
            validate_entity_access(db, admin_b["user"]["tenant_id"], "purchase_order", po.id)
            is False
        )
    finally:
        db.close()
