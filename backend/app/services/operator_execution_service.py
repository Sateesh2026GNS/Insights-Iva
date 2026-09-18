"""Operator execution APIs — my work orders, schedule, machines, production entries."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.machine import Machine
from app.models.production import DailyProductionReport, ProductionEntry, WorkOrder
from app.models.user import User
from app.services.hr_service import list_shifts
from app.services.operator_scope import (
    assert_operator_work_order_access,
    current_work_order_for_machine,
    operator_machines_query,
    recent_machine_status_events,
    resolve_operator_machine_ids,
    scope_work_orders_for_operator,
    user_is_operator_role,
)
from app.services.schedule_service import get_enhanced_timeline
from app.services.work_order_service import (
    COMPLETED_STATUSES,
    PLANNED_STATUSES,
    RUNNING_STATUSES,
    _to_list_read,
    normalize_status,
)

def list_my_work_orders(db: Session, user: User) -> list[dict]:
    stmt = select(WorkOrder).where(WorkOrder.tenant_id == user.tenant_id)
    stmt = scope_work_orders_for_operator(stmt, user, db)
    if user_is_operator_role(user):
        closed = tuple(COMPLETED_STATUSES | {"cancelled", "canceled"})
        stmt = stmt.where(WorkOrder.status.notin_(closed))
    rows = list(db.scalars(stmt.order_by(WorkOrder.id.desc())).all())
    return [_to_list_read(db, user.tenant_id, wo).model_dump(mode="json") for wo in rows]


def get_my_work_order(db: Session, user: User, work_order_id: int) -> dict:
    wo = db.get(WorkOrder, work_order_id)
    if not wo or wo.tenant_id != user.tenant_id:
        raise HTTPException(status_code=404, detail="Work order not found")
    assert_operator_work_order_access(user, wo, db)
    return _to_list_read(db, user.tenant_id, wo).model_dump(mode="json")


def list_operator_shifts(db: Session, user: User) -> list[dict]:
    rows = list_shifts(db, user.tenant_id)
    return [
        {"id": s.id, "name": s.name}
        for s in rows
        if getattr(s, "is_active", True) and (getattr(s, "status", "active") or "active") == "active"
    ]


def my_production_schedule(db: Session, user: User) -> dict:
    machine_ids = set(resolve_operator_machine_ids(db, user))
    timeline = get_enhanced_timeline(db, user.tenant_id)
    if machine_ids:
        timeline = [row for row in timeline if row.machine_id in machine_ids]

    stmt = select(WorkOrder).where(WorkOrder.tenant_id == user.tenant_id)
    stmt = scope_work_orders_for_operator(stmt, user, db)
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
    idempotency_key: str | None = None,
) -> dict:
    produced = Decimal(str(quantity_produced))
    rejected = Decimal(str(quantity_rejected))
    if produced < 0 or rejected < 0:
        raise HTTPException(status_code=400, detail="Quantities must be non-negative")
    if produced == 0 and rejected == 0:
        raise HTTPException(
            status_code=400,
            detail="Enter a produced or rejected quantity greater than zero.",
        )

    reason = (reject_reason or "").strip() or None
    if rejected > 0 and not reason:
        raise HTTPException(status_code=400, detail="Reject reason is required when rejected quantity > 0")

    shift_val = (shift or "").strip() or None

    wo = db.scalars(
        select(WorkOrder)
        .where(WorkOrder.id == work_order_id, WorkOrder.tenant_id == user.tenant_id)
        .with_for_update()
    ).first()
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    assert_operator_work_order_access(user, wo, db)

    status = normalize_status(wo.status)
    if status in COMPLETED_STATUSES or status in {"cancelled", "canceled"}:
        raise HTTPException(status_code=400, detail="Work order is no longer open for production entry")

    planned = Decimal(str(wo.planned_quantity or 0))
    current = Decimal(str(wo.actual_quantity or 0))
    remaining = planned - current
    if produced > remaining:
        raise HTTPException(
            status_code=400,
            detail=f"Produced quantity exceeds remaining quantity ({remaining}).",
        )

    when = recorded_at or datetime.now(timezone.utc)

    if idempotency_key:
        existing = db.scalars(
            select(ProductionEntry).where(
                ProductionEntry.tenant_id == user.tenant_id,
                ProductionEntry.operator_user_id == user.id,
                ProductionEntry.work_order_id == work_order_id,
                ProductionEntry.recorded_at >= when - timedelta(minutes=2),
            )
        ).first()
        if existing and (
            Decimal(str(existing.quantity_produced)) == produced
            and Decimal(str(existing.quantity_rejected)) == rejected
        ):
            return _serialize_entry(db, existing)

    recent_dup = db.scalars(
        select(ProductionEntry)
        .where(
            ProductionEntry.tenant_id == user.tenant_id,
            ProductionEntry.operator_user_id == user.id,
            ProductionEntry.work_order_id == work_order_id,
            ProductionEntry.quantity_produced == float(produced),
            ProductionEntry.quantity_rejected == float(rejected),
            ProductionEntry.recorded_at >= when - timedelta(seconds=45),
        )
        .limit(1)
    ).first()
    if recent_dup:
        return _serialize_entry(db, recent_dup)

    if not shift_val:
        shift_val = (wo.shift or "").strip() or None
    if not shift_val and wo.machine_id:
        machine = db.get(Machine, wo.machine_id)
        if machine and machine.current_shift:
            shift_val = machine.current_shift

    entry = ProductionEntry(
        tenant_id=user.tenant_id,
        work_order_id=work_order_id,
        job_card_id=job_card_id,
        operator_user_id=user.id,
        quantity_produced=float(produced),
        quantity_rejected=float(rejected),
        reject_reason=reason,
        shift=shift_val,
        recorded_at=when,
    )
    db.add(entry)

    wo.actual_quantity = float(current + produced)
    st = normalize_status(wo.status)
    if st in PLANNED_STATUSES and produced > 0:
        wo.status = "running"
    elif st not in RUNNING_STATUSES and st not in COMPLETED_STATUSES and produced > 0:
        wo.status = "in_progress"
    if planned > 0 and Decimal(str(wo.actual_quantity or 0)) >= planned:
        wo.status = "completed"

    if float(produced) > 0 or float(rejected) > 0:
        from app.models.production import ProductionOrder

        po = db.get(ProductionOrder, wo.production_order_id)
        product_id = po.product_id if po and po.product_id else None
        if product_id:
            report = DailyProductionReport(
                tenant_id=user.tenant_id,
                report_date=when.date(),
                product_id=product_id,
                work_order_id=work_order_id,
                machine_id=wo.machine_id,
                produced_quantity=float(produced),
                scrap_quantity=float(rejected) if rejected > 0 else None,
                notes=reason,
                created_by_user_id=user.id,
            )
            db.add(report)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Could not save production entry. Please refresh and try again.",
        )
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
    detail = _to_list_read(db, entry.tenant_id, wo) if wo else None
    return {
        "id": entry.id,
        "work_order_id": entry.work_order_id,
        "work_order_number": wo.work_order_number if wo else None,
        "product_name": detail.product_name if detail else None,
        "job_card_id": entry.job_card_id,
        "quantity_produced": float(entry.quantity_produced),
        "quantity_rejected": float(entry.quantity_rejected),
        "reject_reason": entry.reject_reason,
        "shift": entry.shift,
        "recorded_at": entry.recorded_at.isoformat() if entry.recorded_at else None,
        "status": wo.status if wo else None,
    }
