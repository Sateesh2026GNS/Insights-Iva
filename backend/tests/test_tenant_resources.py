"""Tenant-scoped row lookups."""

from app.core.database import SessionLocal
from app.models.machine import Machine
from app.services.tenant_resources import get_tenant_row


def test_get_tenant_row_rejects_cross_tenant(register_admin):
    a = register_admin()
    b = register_admin()
    db = SessionLocal()
    try:
        m = Machine(
            tenant_id=a["user"]["tenant_id"],
            code="TR-1",
            name="Tenant A",
            status="idle",
            is_active=True,
        )
        db.add(m)
        db.commit()
        db.refresh(m)
        assert get_tenant_row(db, Machine, m.id, a["user"]["tenant_id"]) is not None
        assert get_tenant_row(db, Machine, m.id, b["user"]["tenant_id"]) is None
    finally:
        db.close()
