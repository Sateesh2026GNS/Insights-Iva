"""Operator execution APIs — my work orders, schedule, machines, production entries.

Domain note: Sales/manufacturing *job cards* (`SalesJobCard`, `WorkflowStageJobCard` via
`job_card_service`) are order-driven workflow documents. *Work orders* (`WorkOrder` on
`production_orders`) are shop-floor execution tasks (machine, quantities). They link via
`WorkflowStageJobCard.work_order_id`. Production entries record output against work orders;
`job_card_id` is optional when a stage card is known.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.production import ProductionEntry, WorkOrder
from app.models.user import User
from app.services.operator_scope import (
    assert_operator_work_order_access,
    current_work_order_for_machine,
    operator_machines_query,
    recent_machine_status_events,
    resolve_operator_machine_ids,
    scope_work_orders_for_operator,
)
from app.services.schedule_service import get_enhanced_timeline
from app.services.work_order_service import _to_list_read, list_work_orders_enriched


def list_my_work_orders(db: Session, user: User) -> list[dict]:
    rows = list_work_orders_enriched(db, user.tenant_id, user=user)
    return [r.model_dump(mode="json") if hasattr(r, "model_dump") else dict(r) for r in rows]


def get_my_work_order(db: Session, user: User, work_order_id: int) -> dict:
    wo = db.get(WorkOrder, work_order_id)
    if not wo or wo.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Work order not found")
    assert_operator_work_order_access(user, wo)
    return _to_list_read(db, user.tenant_id, wo).model_dump(mode="json")


def my_production_schedule(db: Session, user: User) -> dict:
    machine_ids = set(resolve_operator_machine_ids(db, user))
    timeline = get_enhanced_timeline(db, user.tenant_id)
    if machine_ids:
        timeline = [row for row in timeline if row.machine_id in machine_ids]

    stmt = select(WorkOrder).where(WorkOrder.tenant_id == user.tenant_id)
    stmt = scope_work_orders_for_operator(stmt, user)
    work_orders = list(db.scalars(stmt).all())
    return {
        "timeline": [t.model_dump(mode="json") if hasattr(t, "model_dump") else dict(t) for t in timeline],
        "work_orders": [_to_list_read(db, user.tenant_id, wo).model_dump(mode="json") for wo in work_orders],
        "machine_ids": list(machine_ids),
    }


def list_my_machines(db: Session, user: User) -> list[dict]:
    machines = list(db.scalars(operator_machines_query(db, user)).all())
    out = []
    for m in machines:
        wo = current_work_order_for_machine(db, user.tenant_id, m.id)
        events = recent_machine_status_events(db, user, m.id, limit=8)
        out.append(
            {
                "id": m.id,
                "code": m.code,
                "name": m.name,
                "status": m.status,
                "location": m.location,
                "current_shift": m.current_shift,
                "current_work_order": m.current_work_order,
                "active_work_order": (
                    {
                        "id": wo.id,
                        "work_order_number": wo.work_order_number,
                        "status": wo.status,
                    }
                    if wo
                    else None
                ),
                "status_history": [
                    {
                        "status": e.status,
                        "started_at": e.started_at.isoformat() if e.started_at else None,
                        "ended_at": e.ended_at.isoformat() if e.ended_at else None,
                        "reason": e.reason,
                    }
                    for e in events
                ],
            }
        )
    return out


def create_production_entry(
    db: Session,
    user: User,
    *,
    work_order_id: int,
    job_card_id: int | None,
    quantity_produced: float,
    quantity_rejected: float,
    reject_reason: str | None,
    shift: str | None,
    recorded_at: datetime | None,
) -> dict:
    if quantity_produced < 0 or quantity_rejected < 0:
        raise HTTPException(status_code=400, detail="Quantities must be non-negative")
    if quantity_rejected > 0 and not (reject_reason or "").strip():
        raise HTTPException(status_code=400, detail="Reject reason is required when rejected quantity > 0")
    wo = db.get(WorkOrder, work_order_id)
    if not wo or wo.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Work order not found")
    assert_operator_work_order_access(user, wo)

    when = recorded_at or datetime.now(timezone.utc)
    entry = ProductionEntry(
        tenant_id=user.tenant_id,
        work_order_id=work_order_id,
        job_card_id=job_card_id,
        operator_user_id=user.id,
        quantity_produced=quantity_produced,
        quantity_rejected=quantity_rejected,
        reject_reason=reject_reason,
        shift=shift,
        recorded_at=when,
    )
    db.add(entry)
    produced = float(wo.actual_quantity or 0) + float(quantity_produced)
    wo.actual_quantity = produced
    db.commit()
    db.refresh(entry)
    return _serialize_entry(db, entry)


def list_my_production_entries(db: Session, user: User, day: date | None = None) -> list[dict]:
    day = day or datetime.now(timezone.utc).date()
    start = datetime.combine(day, datetime.min.time()).replace(tzinfo=timezone.utc)
    end = datetime.combine(day, datetime.max.time()).replace(tzinfo=timezone.utc)
    rows = list(
        db.scalars(
            select(ProductionEntry)
            .where(
                ProductionEntry.tenant_id == user.tenant_id,
                ProductionEntry.operator_user_id == user.id,
                ProductionEntry.recorded_at >= start,
                ProductionEntry.recorded_at <= end,
            )
            .order_by(ProductionEntry.recorded_at.desc())
        ).all()
    )
    return [_serialize_entry(db, r) for r in rows]


def _serialize_entry(db: Session, entry: ProductionEntry) -> dict:
    wo = db.get(WorkOrder, entry.work_order_id)
    return {
        "id": entry.id,
        "work_order_id": entry.work_order_id,
        "work_order_number": wo.work_order_number if wo else None,
        "job_card_id": entry.job_card_id,
        "quantity_produced": float(entry.quantity_produced),
        "quantity_rejected": float(entry.quantity_rejected),
        "reject_reason": entry.reject_reason,
        "shift": entry.shift,
        "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
    }
