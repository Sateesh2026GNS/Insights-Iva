"""Validate business entities belong to the same tenant before attaching files."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Customer, SalesOrder
from app.models.hr import Employee
from app.models.document import Document


ENTITY_MODELS = {
    "customer": Customer,
    "sales_order": SalesOrder,
    "employee": Employee,
    "document": Document,
}


def validate_entity_access(db: Session, tenant_id: int, entity_type: str, entity_id: int) -> bool:
    model = ENTITY_MODELS.get((entity_type or "").lower().replace("-", "_"))
    if not model:
        # Unknown entity types allowed at API level but flagged — extend registry per module
        return True
    row = db.get(model, entity_id)
    if not row:
        return False
    row_tenant = getattr(row, "tenant_id", None)
    return row_tenant == tenant_id
