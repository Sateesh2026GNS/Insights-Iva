from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.user import User
from app.schemas.crm_tracker import CrmReminderCreate, CrmReminderRead, CrmReminderUpdate, CrmTrackerRead
from app.services.crm_tracker_service import (
    complete_crm_follow_up,
    create_crm_reminder,
    delete_crm_reminder,
    get_crm_tracker,
    update_crm_reminder,
)

router = APIRouter(prefix="/sales", tags=["sales"])
MODULE = "sales"


@router.get("/crm-tracker", response_model=CrmTrackerRead)
def crm_tracker_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    return get_crm_tracker(db, tenant_id)


@router.post("/crm-tracker/follow-ups/{lead_id}/complete", response_model=CrmTrackerRead)
def complete_follow_up_endpoint(
    lead_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return complete_crm_follow_up(db, user.tenant_id, lead_id, user)


@router.post("/crm-reminders", response_model=CrmReminderRead, status_code=201)
def create_reminder_endpoint(
    payload: CrmReminderCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return create_crm_reminder(db, user.tenant_id, payload, user)


@router.patch("/crm-reminders/{reminder_id}", response_model=CrmReminderRead)
def update_reminder_endpoint(
    reminder_id: int,
    payload: CrmReminderUpdate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return update_crm_reminder(db, user.tenant_id, reminder_id, payload)


@router.delete("/crm-reminders/{reminder_id}")
def delete_reminder_endpoint(
    reminder_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    delete_crm_reminder(db, user.tenant_id, reminder_id)
    return {"ok": True, "id": reminder_id}
