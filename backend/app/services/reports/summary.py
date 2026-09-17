from __future__ import annotations

import hashlib
import json
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, StockLevel, StoreIssueRequest
from app.models.procurement import PurchaseOrder, PurchaseOrderLine
from app.models.user import User
from app.services.reports.filters import ReportFilters
from app.services.reports.scope import resolve_accessible_warehouse_ids
from app.utils.ttl_cache import get_or_fetch

_CACHE_TTL = 60.0


def _filter_hash(tenant_id: int, filters: ReportFilters) -> str:
    payload = filters.model_dump(mode="json")
    raw = json.dumps({"tenant": tenant_id, "filters": payload}, sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


def _compute_summary(db: Session, user: User, filters: ReportFilters) -> dict[str, Any]:
    warehouse_ids = resolve_accessible_warehouse_ids(
        db, user.tenant_id, user, filters.warehouse_ids
    )
    if not warehouse_ids:
        return {
            "closing_stock_value": 0.0,
            "low_stock_count": 0,
            "pending_grn_count": 0,
            "issues_in_period": 0,
        }

    value_stmt = (
        select(func.coalesce(func.sum(StockLevel.quantity * InventoryItem.unit_cost), 0))
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == user.tenant_id,
            StockLevel.warehouse_id.in_(warehouse_ids),
        )
    )
    closing_stock_value = float(db.scalar(value_stmt) or 0)

    low_stmt = (
        select(func.count())
        .select_from(StockLevel)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(
            InventoryItem.tenant_id == user.tenant_id,
            StockLevel.warehouse_id.in_(warehouse_ids),
            StockLevel.quantity <= InventoryItem.reorder_level,
        )
    )
    low_stock_count = int(db.scalar(low_stmt) or 0)

    pending_po = (
        select(func.count(func.distinct(PurchaseOrder.id)))
        .join(PurchaseOrderLine, PurchaseOrderLine.purchase_order_id == PurchaseOrder.id)
        .where(
            PurchaseOrder.tenant_id == user.tenant_id,
            PurchaseOrder.status.in_(("approved", "partial", "confirmed")),
        )
    )
    pending_grn_count = int(db.scalar(pending_po) or 0)

    issue_q = select(func.count()).select_from(StoreIssueRequest).where(
        StoreIssueRequest.tenant_id == user.tenant_id,
        StoreIssueRequest.warehouse_id.in_(warehouse_ids),
        StoreIssueRequest.status.in_(("issued", "received", "closed")),
    )
    if filters.date_from:
        issue_q = issue_q.where(func.date(StoreIssueRequest.created_at) >= filters.date_from)
    if filters.date_to:
        issue_q = issue_q.where(func.date(StoreIssueRequest.created_at) <= filters.date_to)
    issues_in_period = int(db.scalar(issue_q) or 0)

    return {
        "closing_stock_value": round(closing_stock_value, 2),
        "low_stock_count": low_stock_count,
        "pending_grn_count": pending_grn_count,
        "issues_in_period": issues_in_period,
    }


def get_report_summary(db: Session, user: User, filters: ReportFilters) -> dict[str, Any]:
    cache_key = f"report_summary:tenant:{user.tenant_id}:{_filter_hash(user.tenant_id, filters)}"
    return get_or_fetch(
        cache_key,
        lambda: _compute_summary(db, user, filters),
        ttl_seconds=_CACHE_TTL,
    )
