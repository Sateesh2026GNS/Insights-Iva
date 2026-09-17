"""Read-only job card lookup for agent and other callers (tenant-scoped)."""

from __future__ import annotations

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.manufacturing_workflow import SalesJobCard, WorkflowStageJobCard
from app.models.sales import SalesOrder
from app.models.user import User


def get_job_card_status_rows(
    db: Session,
    tenant_id: int,
    user: User | None,
    job_card_no: str,
) -> list[dict[str, Any]]:
    """Return a single-row summary list for the given job card number, or empty if not found."""
    no = (job_card_no or "").strip()
    if not no:
        return []

    jc = db.scalar(
        select(SalesJobCard).where(
            SalesJobCard.tenant_id == tenant_id,
            SalesJobCard.job_card_no == no,
        )
    )
    if jc:
        row: dict[str, Any] = {
            "job_card_no": jc.job_card_no,
            "record_type": "sales_job_card",
            "status": jc.status,
            "workflow_stage": jc.workflow_stage,
            "priority": jc.priority,
            "quantity": float(jc.quantity or 0),
            "unit": jc.unit,
        }
        if jc.sales_order_id:
            so = db.get(SalesOrder, jc.sales_order_id)
            row["sales_order_no"] = so.order_number if so else None
            row["workflow_status"] = (so.workflow_status if so else None) or jc.workflow_stage
        else:
            from app.services.manual_job_card_service import build_manual_job_card_response

            resp = build_manual_job_card_response(db, jc, user, store_perspective=True)
            row["workflow_status"] = resp.get("workflow_status")
            row["queue_status"] = resp.get("queue_status_label")
            summary = resp.get("summary_panel") or {}
            row["customer"] = summary.get("customer")
            row["product"] = summary.get("product")
        return [row]

    stage = db.scalar(
        select(WorkflowStageJobCard).where(
            WorkflowStageJobCard.tenant_id == tenant_id,
            WorkflowStageJobCard.card_number == no,
        )
    )
    if stage:
        so = db.get(SalesOrder, stage.sales_order_id)
        return [
            {
                "job_card_no": stage.card_number,
                "record_type": "stage_job_card",
                "stage": stage.stage,
                "status": stage.status,
                "sales_order_no": so.order_number if so else None,
                "workflow_status": so.workflow_status if so else None,
            }
        ]
    return []
