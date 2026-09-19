"""Tenant-scoped primary-key lookups — fail closed on cross-tenant IDs."""

from __future__ import annotations

from sqlalchemy.orm import Session


def get_tenant_row(db: Session, model: type, row_id: int | None, tenant_id: int):
    if row_id is None:
        return None
    row = db.get(model, row_id)
    if not row:
        return None
    row_tenant = getattr(row, "tenant_id", None)
    if row_tenant is not None and row_tenant != tenant_id:
        return None
    return row
