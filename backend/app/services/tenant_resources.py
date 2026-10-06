"""Tenant-scoped primary-key lookups — fail closed on cross-tenant IDs."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session


def get_tenant_row(db: Session, model: type, row_id: int | None, tenant_id: int):
    """Return row only when id exists and tenant_id matches (no cross-tenant fetch)."""
    if row_id is None:
        return None
    stmt = select(model).where(model.id == row_id)
    if hasattr(model, "tenant_id"):
        stmt = stmt.where(model.tenant_id == tenant_id)
    return db.scalars(stmt).first()


def require_tenant_row(
    db: Session,
    model: type,
    row_id: int | None,
    tenant_id: int,
    *,
    not_found_detail: str = "Not found",
):
    row = get_tenant_row(db, model, row_id, tenant_id)
    if not row:
        raise HTTPException(status_code=404, detail=not_found_detail)
    return row
