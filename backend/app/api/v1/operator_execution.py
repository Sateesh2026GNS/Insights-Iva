from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission
from app.models.user import User
from app.schemas.hr import SafetyIncidentCreate
from app.schemas.operator_execution import ProductionEntryCreate, SafetyIncidentOperatorCreate
from app.services.hr_service import create_safety_incident, list_safety_incidents
from app.core.idempotency import get_idempotency_key_header
from app.services.operator_execution_service import (
    create_production_entry,
    get_my_work_order,
    list_my_machines,
    list_my_production_entries,
    list_my_work_orders,
    list_operator_shifts,
    my_production_schedule,
)
router = APIRouter(tags=["operator-execution"])
MODULE = "production"


def _production_user(user: User = Depends(require_permission(MODULE))) -> User:
    return user


@router.get("/work-orders/my")
def my_work_orders(user: User = Depends(_production_user), db: Session = Depends(get_db)):
    return {"items": list_my_work_orders(db, user)}


@router.get("/work-orders/my/{work_order_id}")
def my_work_order_detail(
    work_order_id: int,
    user: User = Depends(_production_user),
    db: Session = Depends(get_db),
):
    return get_my_work_order(db, user, work_order_id)


@router.get("/production-schedule/my")
def my_schedule(user: User = Depends(_production_user), db: Session = Depends(get_db)):
    return my_production_schedule(db, user)


@router.get("/machines/my")
def my_machines(user: User = Depends(_production_user), db: Session = Depends(get_db)):
    return {"items": list_my_machines(db, user)}


@router.get("/shifts/my")
def my_shifts(user: User = Depends(_production_user), db: Session = Depends(get_db)):
    return {"items": list_operator_shifts(db, user)}


@router.post("/production-entries")
def post_production_entry(
    body: ProductionEntryCreate,
    user: User = Depends(_production_user),
    db: Session = Depends(get_db),
    idempotency_key: str | None = Depends(get_idempotency_key_header),
):
    return create_production_entry(
        db,
        user,
        work_order_id=body.work_order_id,
        job_card_id=body.job_card_id,
        quantity_produced=body.quantity_produced,
        quantity_rejected=body.quantity_rejected,
        reject_reason=body.reject_reason,
        shift=body.shift,
        recorded_at=body.recorded_at,
        idempotency_key=idempotency_key,
    )


@router.get("/production-entries/my")
def my_production_entries(
    user: User = Depends(_production_user),
    db: Session = Depends(get_db),
    day: date | None = None,
):
    return {"items": list_my_production_entries(db, user, day)}


@router.post("/safety-incidents")
def operator_safety_incident(
    body: SafetyIncidentOperatorCreate,
    user: User = Depends(_production_user),
    db: Session = Depends(get_db),
):
    from datetime import datetime as dt
    from uuid import uuid4

    code = f"INC-{dt.utcnow().strftime('%Y%m%d')}-{uuid4().hex[:6].upper()}"
    title = f"{body.incident_type.replace('_', ' ').title()} report"
    loc = body.location or ""
    if body.machine_id:
        from app.models.machine import Machine

        m = db.get(Machine, body.machine_id)
        if m and m.tenant_id == user.tenant_id:
            loc = loc or m.name or m.code
    payload = SafetyIncidentCreate(
        incident_code=code,
        title=title,
        type=body.incident_type,
        reporter=user.full_name or user.email,
        incident_date=dt.utcnow().date(),
        severity=body.severity,
        status="open",
        description=(body.description or "").strip() or None,
    )
    row = create_safety_incident(db, user.tenant_id, payload)
    return row


@router.get("/safety-incidents/my")
def my_safety_incidents(user: User = Depends(_production_user), db: Session = Depends(get_db)):
    reporter = user.full_name or user.email
    rows = list_safety_incidents(db, user.tenant_id)
    mine = [r for r in rows if (r.reporter or "").strip() == (reporter or "").strip()]
    return {"items": mine}
