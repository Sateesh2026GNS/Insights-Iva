"""Paginated detail lists for Admin dashboard Quick Actions (filters match dashboard_service summary)."""

from __future__ import annotations

from datetime import date

from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, StockMovement, StockTransfer, StoreIssueRequest, Warehouse
from app.models.procurement import MaterialRequest
from app.models.product import Product
from app.models.production import DailyProductionReport, ProductionEntry, ProductionOrder, WorkOrder
from app.models.quality import QualityInspection

# Keep filter buckets aligned with _get_quick_actions_summary in dashboard_service.py
WO_DONE = ("completed", "closed", "done")
WO_PENDING = ("planned", "pending", "on_hold", "hold", "paused")
WO_IN_PROGRESS = ("in_progress", "running", "active")

PO_PENDING = ("planned", "pending", "draft")
PO_IN_PROGRESS = ("in_progress", "running", "active")
PO_DONE = ("completed", "closed", "done")

ST_PENDING = ("draft", "pending", "pending_approval")
ST_TRANSIT = ("in_transit",)
ST_DONE = ("completed", "received")

OUT_TYPES = ("out", "issue", "material_issue")


def _page(total: int, page: int, page_size: int) -> dict:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    if total and page > total_pages:
        page = total_pages
    return {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages}


def _wo_filter(filter_key: str, today: date):
    base = []
    fk = (filter_key or "pending").lower()
    if fk == "today":
        base.append(func.date(WorkOrder.created_at) == today)
    elif fk == "pending":
        base.append(WorkOrder.status.in_(WO_PENDING))
    elif fk in ("in_progress", "inprogress"):
        base.append(WorkOrder.status.in_(WO_IN_PROGRESS))
    elif fk == "completed":
        base.append(
            and_(
                WorkOrder.status.in_(WO_DONE),
                or_(func.date(WorkOrder.updated_at) == today, func.date(WorkOrder.created_at) == today),
            )
        )
    else:
        base.append(WorkOrder.status.in_(WO_PENDING))
    return base


def list_work_orders_detail(
    db: Session,
    tenant_id: int,
    today: date,
    *,
    filter_key: str = "pending",
    search: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    conds = [WorkOrder.tenant_id == tenant_id, *_wo_filter(filter_key, today)]
    if search:
        q = f"%{search.strip()}%"
        conds.append(
            or_(
                WorkOrder.work_order_number.ilike(q),
                WorkOrder.operator_name.ilike(q),
                WorkOrder.department.ilike(q),
            )
        )
    total = int(db.scalar(select(func.count(WorkOrder.id)).where(*conds)) or 0)
    meta = _page(total, page, page_size)
    offset = (meta["page"] - 1) * meta["page_size"]
    rows = db.execute(
        select(
            WorkOrder,
            Product.name,
            ProductionOrder.order_number,
        )
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(*conds)
        .order_by(WorkOrder.id.desc())
        .offset(offset)
        .limit(meta["page_size"])
    ).all()
    items = []
    for wo, product_name, po_num in rows:
        actual = float(wo.actual_quantity or 0)
        planned = float(wo.planned_quantity or 0)
        items.append(
            {
                "id": wo.id,
                "code": wo.work_order_number,
                "product_name": product_name or po_num or "—",
                "status": wo.status,
                "progress": f"{actual:g}/{planned:g}",
                "department": wo.department,
            }
        )
    return {**meta, "items": items, "filter": filter_key}


def production_detail_summary(db: Session, tenant_id: int, today: date) -> dict:
    produced = int(
        db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date == today,
            )
        )
        or 0
    )
    rejected = int(
        db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date == today,
            )
        )
        or 0
    )
    entries = int(
        db.scalar(
            select(func.count(ProductionEntry.id)).where(
                ProductionEntry.tenant_id == tenant_id,
                func.date(ProductionEntry.recorded_at) == today,
            )
        )
        or 0
    )
    po_base = ProductionOrder.tenant_id == tenant_id
    in_progress = int(
        db.scalar(
            select(func.count(ProductionOrder.id)).where(po_base, ProductionOrder.status.in_(PO_IN_PROGRESS))
        )
        or 0
    )
    pending = int(
        db.scalar(
            select(func.count(ProductionOrder.id)).where(po_base, ProductionOrder.status.in_(PO_PENDING))
        )
        or 0
    )
    return {
        "produced_quantity": produced,
        "rejected_quantity": rejected,
        "entries": entries,
        "in_progress": in_progress,
        "pending": pending,
    }


def list_production_entries_detail(
    db: Session,
    tenant_id: int,
    today: date,
    *,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    conds = [
        ProductionEntry.tenant_id == tenant_id,
        func.date(ProductionEntry.recorded_at) == today,
    ]
    total = int(db.scalar(select(func.count(ProductionEntry.id)).where(*conds)) or 0)
    meta = _page(total, page, page_size)
    offset = (meta["page"] - 1) * meta["page_size"]
    rows = db.execute(
        select(ProductionEntry, WorkOrder.work_order_number, Product.name)
        .join(WorkOrder, ProductionEntry.work_order_id == WorkOrder.id)
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(*conds)
        .order_by(ProductionEntry.recorded_at.desc())
        .offset(offset)
        .limit(meta["page_size"])
    ).all()
    items = []
    for entry, wo_code, product_name in rows:
        items.append(
            {
                "id": entry.id,
                "work_order": wo_code,
                "product_name": product_name,
                "quantity": float(entry.quantity_produced or 0),
                "rejected": float(entry.quantity_rejected or 0),
                "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
            }
        )
    return {**meta, "items": items, "summary": production_detail_summary(db, tenant_id, today)}


def _material_issue_filter(filter_key: str, today: date):
    fk = (filter_key or "pending").lower()
    if fk == "issued":
        return "issued"
    if fk == "today":
        return "today"
    return "pending"


def list_material_issues_detail(
    db: Session,
    tenant_id: int,
    today: date,
    *,
    filter_key: str = "pending",
    page: int = 1,
    page_size: int = 10,
) -> dict:
    fk = _material_issue_filter(filter_key, today)
    items: list[dict] = []
    if fk == "pending":
        pending_store = db.execute(
            select(StoreIssueRequest, InventoryItem.name)
            .join(InventoryItem, StoreIssueRequest.item_id == InventoryItem.id)
            .where(
                StoreIssueRequest.tenant_id == tenant_id,
                StoreIssueRequest.status == "pending",
            )
            .order_by(StoreIssueRequest.id.desc())
        ).all()
        for r, item_name in pending_store:
            item_name = item_name or f"Item #{r.item_id}"
            items.append(
                {
                    "id": r.id,
                    "code": r.request_number,
                    "material": item_name,
                    "quantity": r.quantity,
                    "status": r.status,
                    "kind": "store_issue",
                    "date": r.created_at.date().isoformat() if r.created_at else None,
                }
            )
        pending_mr = list(
            db.scalars(
                select(MaterialRequest).where(
                    MaterialRequest.tenant_id == tenant_id,
                    MaterialRequest.approval_status == "pending",
                )
            ).all()
        )
        for mr in pending_mr:
            items.append(
                {
                    "id": mr.id,
                    "code": mr.mr_number,
                    "material": mr.notes or "Material request",
                    "quantity": None,
                    "status": "pending",
                    "kind": "material_request",
                    "date": mr.request_date.isoformat() if mr.request_date else None,
                }
            )
    elif fk == "issued":
        moves = db.execute(
            select(StockMovement, InventoryItem.name)
            .join(InventoryItem, StockMovement.item_id == InventoryItem.id)
            .where(
                StockMovement.tenant_id == tenant_id,
                StockMovement.movement_type.in_(OUT_TYPES),
                func.date(StockMovement.created_at) == today,
            )
            .order_by(StockMovement.id.desc())
        ).all()
        for m, item_name in moves:
            item_name = item_name or f"Item #{m.item_id}"
            items.append(
                {
                    "id": m.id,
                    "code": f"SM-{m.id}",
                    "material": item_name,
                    "quantity": int(m.quantity or 0),
                    "status": "issued",
                    "kind": "stock_movement",
                    "date": today.isoformat(),
                }
            )
    else:
        # today = issued today + pending count representation
        issued = list_material_issues_detail(db, tenant_id, today, filter_key="issued", page=1, page_size=500)["items"]
        pending = list_material_issues_detail(db, tenant_id, today, filter_key="pending", page=1, page_size=500)["items"]
        items = issued + pending

    total = len(items)
    meta = _page(total, page, page_size)
    start = (meta["page"] - 1) * meta["page_size"]
    page_items = items[start : start + meta["page_size"]]
    return {**meta, "items": page_items, "filter": fk}


def _st_filter(filter_key: str):
    fk = (filter_key or "pending").lower()
    if fk in ("in_transit", "intransit"):
        return ST_TRANSIT
    if fk == "completed":
        return ST_DONE
    return ST_PENDING


def list_stock_transfers_detail(
    db: Session,
    tenant_id: int,
    today: date,
    *,
    filter_key: str = "pending",
    page: int = 1,
    page_size: int = 10,
) -> dict:
    statuses = _st_filter(filter_key)
    conds = [StockTransfer.tenant_id == tenant_id, StockTransfer.status.in_(statuses)]
    total = int(db.scalar(select(func.count(StockTransfer.id)).where(*conds)) or 0)
    meta = _page(total, page, page_size)
    offset = (meta["page"] - 1) * meta["page_size"]
    rows = list(
        db.scalars(
            select(StockTransfer).where(*conds).order_by(StockTransfer.id.desc()).offset(offset).limit(meta["page_size"])
        ).all()
    )
    wh_ids = set()
    for t in rows:
        wh_ids.add(t.from_warehouse_id)
        wh_ids.add(t.to_warehouse_id)
    wh_map = {}
    if wh_ids:
        for w in db.scalars(select(Warehouse).where(Warehouse.id.in_(wh_ids))).all():
            wh_map[w.id] = w.name
    items = []
    for t in rows:
        items.append(
            {
                "id": t.id,
                "code": t.transfer_number,
                "from_warehouse": wh_map.get(t.from_warehouse_id, "—"),
                "to_warehouse": wh_map.get(t.to_warehouse_id, "—"),
                "quantity": int(t.quantity or 0),
                "status": t.status,
            }
        )
    return {**meta, "items": items, "filter": filter_key}


def _qc_filter(filter_key: str):
    fk = (filter_key or "pending").lower()
    if fk == "passed":
        return "passed"
    if fk == "failed":
        return "failed"
    if fk == "rework":
        return "rework"
    return "pending"


def list_quality_detail(
    db: Session,
    tenant_id: int,
    today: date,
    *,
    filter_key: str = "pending",
    page: int = 1,
    page_size: int = 10,
) -> dict:
    fk = _qc_filter(filter_key)
    base = [QualityInspection.tenant_id == tenant_id]
    if fk == "pending":
        base.append(QualityInspection.status.in_(("pending", "open", "in_review")))
    elif fk == "passed":
        base.append(
            or_(
                QualityInspection.result.in_(("pass", "passed")),
                QualityInspection.status.in_(("passed", "approved")),
            )
        )
    elif fk == "failed":
        base.append(
            or_(
                QualityInspection.result.in_(("fail", "failed")),
                QualityInspection.status.in_(("failed", "rejected")),
            )
        )
    else:
        base.append(
            or_(
                QualityInspection.result.in_(("rework", "rework_required", "conditional")),
                QualityInspection.status == "rework",
            )
        )
    total = int(db.scalar(select(func.count(QualityInspection.id)).where(*base)) or 0)
    meta = _page(total, page, page_size)
    offset = (meta["page"] - 1) * meta["page_size"]
    rows = list(
        db.scalars(
            select(QualityInspection).where(*base).order_by(QualityInspection.id.desc()).offset(offset).limit(meta["page_size"])
        ).all()
    )
    items = []
    for q in rows:
        label = q.product_name or q.material_name or q.work_order_number or "Inspection"
        status = q.status if fk == "pending" else (q.result or q.status)
        items.append(
            {
                "id": q.id,
                "code": q.inspection_number,
                "product_name": label,
                "status": status,
                "inspection_date": q.inspection_date.isoformat() if q.inspection_date else None,
            }
        )
    return {**meta, "items": items, "filter": fk}
