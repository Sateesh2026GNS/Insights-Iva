"""Resolve ERP record links in chat — tenant scope + RBAC."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.permissions import user_has_permission
from app.models.manufacturing_workflow import SalesJobCard
from app.models.production import ProductionOrder
from app.models.sales import Customer, Lead, Quotation, SalesOrder
from app.models.user import User

ENTITY_MODULE = {
    "customer": "sales",
    "sales_order": "sales",
    "quotation": "sales",
    "lead": "sales",
    "sales_job_card": "sales",
    "production_order": "production",
}

ENTITY_MODELS = {
    "customer": Customer,
    "sales_order": SalesOrder,
    "quotation": Quotation,
    "lead": Lead,
    "sales_job_card": SalesJobCard,
    "production_order": ProductionOrder,
}


def _display_label(row, entity_type: str) -> str:
    if entity_type == "customer":
        return getattr(row, "name", None) or getattr(row, "company_name", None) or f"Customer #{row.id}"
    if entity_type == "sales_order":
        return getattr(row, "order_number", None) or f"SO-{row.id}"
    if entity_type == "quotation":
        return getattr(row, "quotation_number", None) or f"QT-{row.id}"
    if entity_type == "lead":
        return getattr(row, "company_name", None) or getattr(row, "customer_name", None) or f"Lead #{row.id}"
    if entity_type == "sales_job_card":
        return getattr(row, "job_card_no", None) or f"JC-{row.id}"
    if entity_type == "production_order":
        return getattr(row, "order_number", None) or f"PO-{row.id}"
    return f"{entity_type} #{row.id}"


def _frontend_path(entity_type: str, entity_id: int, row) -> str:
    if entity_type == "customer":
        return "/sales/customers"
    if entity_type == "sales_order":
        return f"/sales/orders/{entity_id}"
    if entity_type == "quotation":
        return f"/sales/quotations/{entity_id}"
    if entity_type == "lead":
        return "/sales/leads"
    if entity_type == "sales_job_card":
        return f"/sales/job-cards/{entity_id}"
    if entity_type == "production_order":
        return "/production/work-orders"
    return "/"


def resolve_entity_link(
    db: Session,
    user: User,
    entity_type: str,
    entity_id: int,
) -> dict | None:
    key = (entity_type or "").lower().replace("-", "_")
    model = ENTITY_MODELS.get(key)
    if not model:
        return None
    module = ENTITY_MODULE.get(key)
    if module and not user_has_permission(user, module):
        return None
    row = db.get(model, entity_id)
    if not row or getattr(row, "tenant_id", None) != user.tenant_id:
        return None
    label = _display_label(row, key)
    return {
        "entity_type": key,
        "entity_id": entity_id,
        "label": label,
        "path": _frontend_path(key, entity_id, row),
    }
