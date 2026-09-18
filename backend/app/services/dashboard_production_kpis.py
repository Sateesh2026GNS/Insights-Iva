"""Shared production KPI aggregations for Admin pipeline and Production Manager hub."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.manufacturing_workflow import SalesJobCard
from app.models.product import Product
from app.models.production import DailyProductionReport, ProductionOrder, WorkOrder
from app.models.sales import SalesOrder

# Work-order pipeline stages (Admin Production Pipeline strip).
# Each status appears in at most one stage (mutually exclusive buckets).
PIPELINE_PENDING = ("pending", "on_hold", "hold", "paused")
PIPELINE_PLANNED = ("draft", "planned", "released", "material_ready", "machine_ready")
PIPELINE_IN_PRODUCTION = ("in_progress", "running", "started", "active")
PIPELINE_QC = ("quality_check", "qc_pending", "pending_qc")
PIPELINE_COMPLETED = ("completed", "closed", "done")

PIPELINE_STAGE_STATUSES: dict[str, tuple[str, ...]] = {
    "pending": PIPELINE_PENDING,
    "planned": PIPELINE_PLANNED,
    "in_production": PIPELINE_IN_PRODUCTION,
    "qc": PIPELINE_QC,
    "completed": PIPELINE_COMPLETED,
}

# Resolve stage for a single work-order status (first matching bucket wins).
_PIPELINE_STAGE_RESOLVE_ORDER = (
    "completed",
    "qc",
    "in_production",
    "planned",
    "pending",
)


def pipeline_statuses_for_stage(stage: str) -> tuple[str, ...]:
    key = (stage or "").strip().lower().replace("-", "_")
    if key == "inproduction":
        key = "in_production"
    statuses = PIPELINE_STAGE_STATUSES.get(key)
    if not statuses:
        raise ValueError(f"Unknown pipeline stage '{stage}'")
    return statuses


def pipeline_stage_for_status(status: str | None) -> str | None:
    norm = (status or "").strip().lower()
    if not norm:
        return None
    for stage in _PIPELINE_STAGE_RESOLVE_ORDER:
        if norm in PIPELINE_STAGE_STATUSES[stage]:
            return stage
    return None


def _page_meta(total: int, page: int, page_size: int) -> dict:
    page = max(1, page)
    page_size = min(max(1, page_size), 100)
    total_pages = max(1, (total + page_size - 1) // page_size) if total else 0
    if total and page > total_pages:
        page = total_pages
    return {"page": page, "page_size": page_size, "total": total, "total_pages": total_pages}

# Job card workflow stages (Production Manager summary)
JC_PENDING_STAGES = (
    "SAVED",
    "RETURNED_TO_SALES",
    "READY_FOR_PRODUCTION",
    "PRODUCTION_ASSIGNED",
)
JC_IN_PROGRESS_STAGES = ("PRODUCTION_IN_PROGRESS", "PRODUCTION_REWORK")
JC_QC_PENDING_STAGES = ("QUALITY_CHECK_PENDING", "QUALITY_ON_HOLD", "PRODUCTION_COMPLETED")
JC_MATERIAL_WAITING_STAGES = ("MATERIAL_SHORTAGE", "MATERIAL_PARTIAL")
JC_TERMINAL_STAGES = ("COMPLETED", "CANCELLED")


def _count_job_cards(db: Session, tenant_id: int, *conditions) -> int:
    base = SalesJobCard.tenant_id == tenant_id
    return int(db.scalar(select(func.count(SalesJobCard.id)).where(base, *conditions)) or 0)


def get_production_pipeline_counts(db: Session, tenant_id: int) -> dict[str, int]:
    """Work-order counts by pipeline stage for the Admin dashboard strip."""
    base = WorkOrder.tenant_id == tenant_id

    def _stage_count(statuses: tuple[str, ...]) -> int:
        return int(
            db.scalar(
                select(func.count(WorkOrder.id)).where(base, WorkOrder.status.in_(statuses))
            )
            or 0
        )

    return {
        "pending": _stage_count(PIPELINE_PENDING),
        "planned": _stage_count(PIPELINE_PLANNED),
        "in_production": _stage_count(PIPELINE_IN_PRODUCTION),
        "qc": _stage_count(PIPELINE_QC),
        "completed": _stage_count(PIPELINE_COMPLETED),
    }


def list_pipeline_work_orders(
    db: Session,
    tenant_id: int,
    today: date,
    *,
    stage: str,
    search: str | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    """Paginated work orders for one pipeline stage (same filters as stage counts)."""
    statuses = pipeline_statuses_for_stage(stage)
    conds = [WorkOrder.tenant_id == tenant_id, WorkOrder.status.in_(statuses)]
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
    meta = _page_meta(total, page, page_size)
    offset = (meta["page"] - 1) * meta["page_size"]
    rows = db.execute(
        select(
            WorkOrder,
            Product.name,
            ProductionOrder.order_number,
            ProductionOrder.sales_order_number,
            ProductionOrder.customer_name,
        )
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(Product, ProductionOrder.product_id == Product.id)
        .where(*conds)
        .order_by(WorkOrder.id.desc())
        .offset(offset)
        .limit(meta["page_size"])
    ).all()
    items = []
    for wo, product_name, po_num, so_num, customer in rows:
        planned = float(wo.planned_quantity or 0)
        produced = float(wo.actual_quantity or 0)
        items.append(
            {
                "id": wo.id,
                "code": wo.work_order_number,
                "product_name": product_name or "—",
                "status": wo.status,
                "planned_quantity": planned,
                "produced_quantity": produced,
                "remaining_quantity": max(planned - produced, 0),
                "priority": wo.priority,
                "operator_name": wo.operator_name,
                "department": wo.department,
                "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
                "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
                "production_order": po_num,
                "sales_order_number": so_num,
                "customer_name": customer,
            }
        )
    return {**meta, "items": items, "stage": stage}


def get_production_manager_summary(db: Session, tenant_id: int, today: date) -> dict[str, int | float]:
    """Operational KPIs for the Production Manager dashboard."""
    jc_base = SalesJobCard.tenant_id == tenant_id

    job_cards_pending = _count_job_cards(
        db,
        tenant_id,
        or_(
            SalesJobCard.workflow_stage.in_(JC_PENDING_STAGES),
            SalesJobCard.workflow_stage.is_(None),
            SalesJobCard.workflow_stage == "",
        ),
    )
    job_cards_in_progress = _count_job_cards(
        db,
        tenant_id,
        SalesJobCard.workflow_stage.in_(JC_IN_PROGRESS_STAGES),
    )
    pending_qc = _count_job_cards(
        db,
        tenant_id,
        SalesJobCard.workflow_stage.in_(JC_QC_PENDING_STAGES),
    )

    produced_today = float(
        db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date == today,
            )
        )
        or 0
    )
    if produced_today <= 0:
        # Fallback: sum actual quantity on work orders completed today when daily reports absent.
        from datetime import datetime, time

        today_start = datetime.combine(today, time.min)
        produced_today = float(
            db.scalar(
                select(func.coalesce(func.sum(WorkOrder.actual_quantity), 0)).where(
                    WorkOrder.tenant_id == tenant_id,
                    WorkOrder.status.in_(PIPELINE_COMPLETED),
                    WorkOrder.updated_at >= today_start,
                )
            )
            or 0
        )

    return {
        "job_cards_pending": job_cards_pending,
        "job_cards_in_progress": job_cards_in_progress,
        "produced_today": produced_today,
        "pending_qc": pending_qc,
    }


def get_production_manager_action_required(db: Session, tenant_id: int, today: date) -> dict[str, int]:
    """Action-required counts for the Production Manager dashboard."""
    so_material = int(
        db.scalar(
            select(func.count(SalesOrder.id)).where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.workflow_status.in_(JC_MATERIAL_WAITING_STAGES),
            )
        )
        or 0
    )
    manual_jc_material = _count_job_cards(
        db,
        tenant_id,
        SalesJobCard.sales_order_id.is_(None),
        SalesJobCard.workflow_stage.in_(JC_MATERIAL_WAITING_STAGES),
    )
    material_waiting = so_material + manual_jc_material

    overdue_production = int(
        db.scalar(
            select(func.count(SalesJobCard.id)).where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.required_delivery_date.isnot(None),
                SalesJobCard.required_delivery_date < today,
                SalesJobCard.workflow_stage.isnot(None),
                SalesJobCard.workflow_stage != "",
                ~SalesJobCard.workflow_stage.in_(
                    (*JC_TERMINAL_STAGES, "SAVED", "RETURNED_TO_SALES")
                ),
            )
        )
        or 0
    )

    return {
        "material_waiting": material_waiting,
        "overdue_production": overdue_production,
    }
