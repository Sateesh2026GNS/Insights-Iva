"""Shared production KPI aggregations for Admin pipeline and Production Manager hub."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.manufacturing_workflow import SalesJobCard
from app.models.production import DailyProductionReport, WorkOrder
from app.models.sales import SalesOrder

# Work-order pipeline stages (Admin Production Pipeline strip)
PIPELINE_PENDING = ("pending", "on_hold", "hold", "paused")
PIPELINE_PLANNED = ("draft", "planned", "released", "material_ready", "machine_ready")
PIPELINE_IN_PRODUCTION = ("in_progress", "running", "started", "active")
PIPELINE_QC = ("quality_check", "qc_pending", "pending_qc")
PIPELINE_COMPLETED = ("completed", "closed", "done")

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
