"""CRUD and workflow for process_checklist_items."""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, get_user_permissions, user_is_admin
from app.models.manufacturing_toolkit import ProcessChecklistItem
from app.models.user import User
from app.schemas.process_checklist import (
    ProcessChecklistItemApproval,
    ProcessChecklistItemAssign,
    ProcessChecklistItemCreate,
    ProcessChecklistItemStatusChange,
    ProcessChecklistItemUpdate,
    ProcessChecklistItemVerify,
    VALID_CHECKLIST_STATUSES,
)
from app.services.audit_service import log_audit

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "pending": frozenset({"scheduled", "in_progress", "cancelled"}),
    "scheduled": frozenset({"pending", "in_progress", "cancelled"}),
    "in_progress": frozenset({"pending", "scheduled", "cancelled"}),
    "completed": frozenset({"approved", "pending"}),
    "approved": frozenset({"pending"}),
    "cancelled": frozenset({"pending"}),
}

TERMINAL_FOR_EDIT = frozenset({"approved", "cancelled"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _today() -> date:
    return date.today()


def _can_approve(user: User) -> bool:
    if user_is_admin(user):
        return True
    roles = {r.lower() for r in get_role_names(user) if r}
    return any("manager" in r or "quality" in r or "admin" in r for r in roles)


def _production_elevated(user: User) -> bool:
    perms = get_user_permissions(user)
    if "production:*" in perms or "production:update" in perms:
        return True
    roles = {r.lower() for r in get_role_names(user) if r}
    return any("manager" in r or "admin" in r for r in roles)


def _is_named_owner(user: User, owner_name: str | None) -> bool:
    owner = (owner_name or "").strip().lower()
    if not owner:
        return False
    full = (user.full_name or "").strip().lower()
    email = (user.email or "").strip().lower()
    if owner == full or owner == email:
        return True
    if full and owner in full:
        return True
    return False


def _can_assign_checklist(user: User) -> bool:
    return user_is_admin(user) or _can_approve(user) or _production_elevated(user)


def _can_work_checklist(user: User, item: ProcessChecklistItem) -> bool:
    if user_is_admin(user) or _can_approve(user) or _production_elevated(user):
        return True
    return _is_named_owner(user, item.owner_name)


def _display_overdue(item: ProcessChecklistItem) -> bool:
    if not item.due_date:
        return False
    if item.status in ("completed", "approved", "cancelled"):
        return False
    return item.due_date < _today()


def item_to_register_row(item: ProcessChecklistItem) -> dict:
    st = item.status or "pending"
    if _display_overdue(item):
        st = "overdue"
    return {
        "id": item.checklist_code,
        "stage": item.process_stage,
        "item": item.description,
        "owner": item.owner_name or "—",
        "due": item.due_date.strftime("%d-%b") if item.due_date else "—",
        "status": st,
        "result": item.verification_result or "pending",
    }


def aggregate_checklist_metrics(items: list[ProcessChecklistItem]) -> dict:
    """KPI definitions: counts from provided item list (caller filters date range)."""
    today = _today()
    completed = sum(1 for i in items if i.status in ("completed", "approved"))
    pending = sum(1 for i in items if i.status in ("pending", "scheduled", "in_progress"))
    failed = sum(1 for i in items if (i.verification_result or "").lower() in ("fail", "failed"))
    overdue = sum(1 for i in items if _display_overdue(i))
    approved = sum(1 for i in items if i.status == "approved" or i.approved_at)
    compliance_pct = round(completed / len(items) * 100, 1) if items else None
    return {
        "total": len(items),
        "completed": completed,
        "pending": pending,
        "failed": failed,
        "overdue": overdue,
        "approved": approved,
        "compliance_pct": compliance_pct,
    }


def _next_code(db: Session, tenant_id: int) -> str:
    prefix = f"CHK-{date.today().year}-"
    n = (
        db.scalar(
            select(func.count())
            .select_from(ProcessChecklistItem)
            .where(
                ProcessChecklistItem.tenant_id == tenant_id,
                ProcessChecklistItem.checklist_code.like(f"{prefix}%"),
            )
        )
        or 0
    )
    return f"{prefix}{n + 1:04d}"


def get_item(db: Session, tenant_id: int, item_id: int) -> ProcessChecklistItem | None:
    return db.scalars(
        select(ProcessChecklistItem).where(
            ProcessChecklistItem.id == item_id,
            ProcessChecklistItem.tenant_id == tenant_id,
        )
    ).first()


def to_read_schema(item: ProcessChecklistItem):
    from app.schemas.process_checklist import ProcessChecklistItemRead

    return ProcessChecklistItemRead.model_validate(item).model_copy(
        update={"is_overdue": _display_overdue(item)}
    )


def _apply_list_filters(stmt, *, search, process_stage, owner_name, frequency, status, due_from, due_to, pending_only, overdue_only):
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                ProcessChecklistItem.description.ilike(q),
                ProcessChecklistItem.checklist_code.ilike(q),
                ProcessChecklistItem.process_stage.ilike(q),
            )
        )
    if process_stage:
        stmt = stmt.where(ProcessChecklistItem.process_stage.ilike(f"%{process_stage.strip()}%"))
    if owner_name:
        stmt = stmt.where(ProcessChecklistItem.owner_name.ilike(f"%{owner_name.strip()}%"))
    if frequency:
        stmt = stmt.where(ProcessChecklistItem.frequency == frequency.strip())
    if status:
        stmt = stmt.where(ProcessChecklistItem.status == status.strip().lower())
    if due_from:
        stmt = stmt.where(ProcessChecklistItem.due_date >= due_from)
    if due_to:
        stmt = stmt.where(ProcessChecklistItem.due_date <= due_to)
    if pending_only:
        stmt = stmt.where(
            ProcessChecklistItem.status.in_(("pending", "scheduled", "in_progress"))
        )
    if overdue_only:
        today = _today()
        stmt = stmt.where(
            ProcessChecklistItem.due_date.isnot(None),
            ProcessChecklistItem.due_date < today,
            ProcessChecklistItem.status.notin_(("completed", "approved", "cancelled")),
        )
    return stmt


def list_items(
    db: Session,
    tenant_id: int,
    *,
    page: int = 1,
    page_size: int = 25,
    sort_by: str = "due_date",
    sort_dir: str = "asc",
    search: str | None = None,
    process_stage: str | None = None,
    owner_name: str | None = None,
    frequency: str | None = None,
    status: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
    overdue_only: bool = False,
    pending_only: bool = False,
) -> tuple[list[ProcessChecklistItem], int]:
    base = select(ProcessChecklistItem).where(ProcessChecklistItem.tenant_id == tenant_id)
    filtered = _apply_list_filters(
        base,
        search=search,
        process_stage=process_stage,
        owner_name=owner_name,
        frequency=frequency,
        status=status,
        due_from=due_from,
        due_to=due_to,
        pending_only=pending_only,
        overdue_only=overdue_only,
    )
    count_stmt = select(func.count()).select_from(filtered.subquery())
    total = int(db.scalar(count_stmt) or 0)

    stmt = _apply_list_filters(
        select(ProcessChecklistItem).where(ProcessChecklistItem.tenant_id == tenant_id),
        search=search,
        process_stage=process_stage,
        owner_name=owner_name,
        frequency=frequency,
        status=status,
        due_from=due_from,
        due_to=due_to,
        pending_only=pending_only,
        overdue_only=overdue_only,
    )

    sort_columns = {
        "due_date": ProcessChecklistItem.due_date,
        "process_stage": ProcessChecklistItem.process_stage,
        "status": ProcessChecklistItem.status,
        "checklist_code": ProcessChecklistItem.checklist_code,
        "created_at": ProcessChecklistItem.created_at,
    }
    col = sort_columns.get(sort_by, ProcessChecklistItem.due_date)
    stmt = stmt.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())

    page = max(1, page)
    page_size = min(max(1, page_size), 500)
    rows = list(db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all())
    return rows, total


def create_item(
    db: Session, tenant_id: int, user: User, payload: ProcessChecklistItemCreate
) -> ProcessChecklistItem:
    code = (payload.checklist_code or "").strip() or _next_code(db, tenant_id)
    if db.scalars(
        select(ProcessChecklistItem).where(
            ProcessChecklistItem.tenant_id == tenant_id,
            ProcessChecklistItem.checklist_code == code,
        )
    ).first():
        raise HTTPException(status_code=409, detail="Checklist code already exists for this tenant.")

    row = ProcessChecklistItem(
        tenant_id=tenant_id,
        checklist_code=code,
        process_stage=payload.process_stage,
        description=payload.description,
        owner_name=payload.owner_name,
        due_date=payload.due_date,
        frequency=payload.frequency,
        status=payload.status,
        verification_result="pending",
    )
    db.add(row)
    try:
        db.flush()
        log_audit(
            db,
            tenant_id=tenant_id,
            user_id=user.id,
            action="create",
            resource="process_checklist_item",
            resource_id=row.id,
            details=f"Created checklist {code}",
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Checklist code already exists for this tenant.") from None
    db.refresh(row)
    return row


def update_item(
    db: Session, tenant_id: int, user: User, item_id: int, payload: ProcessChecklistItemUpdate
) -> ProcessChecklistItem:
    row = get_item(db, tenant_id, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    if not _can_work_checklist(user, row):
        raise HTTPException(status_code=403, detail="Not authorized to edit this checklist item.")
    if row.status in TERMINAL_FOR_EDIT:
        raise HTTPException(status_code=403, detail="Cannot edit approved or cancelled checklist items.")

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="update",
        resource="process_checklist_item",
        resource_id=row.id,
        details=f"Updated checklist {row.checklist_code}",
    )
    db.commit()
    db.refresh(row)
    return row


def assign_item(
    db: Session, tenant_id: int, user: User, item_id: int, payload: ProcessChecklistItemAssign
) -> ProcessChecklistItem:
    if not _can_assign_checklist(user):
        raise HTTPException(status_code=403, detail="Not authorized to assign checklist owners.")
    row = get_item(db, tenant_id, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    if row.status in TERMINAL_FOR_EDIT:
        raise HTTPException(status_code=403, detail="Cannot assign on approved or cancelled items.")

    row.owner_name = payload.owner_name
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="assign",
        resource="process_checklist_item",
        resource_id=row.id,
        details=f"Assigned {row.checklist_code} to {payload.owner_name}",
    )
    db.commit()
    db.refresh(row)
    return row


def verify_item(
    db: Session, tenant_id: int, user: User, item_id: int, payload: ProcessChecklistItemVerify
) -> ProcessChecklistItem:
    row = get_item(db, tenant_id, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    if not _can_work_checklist(user, row):
        raise HTTPException(status_code=403, detail="Not authorized to verify this checklist item.")
    if row.status in TERMINAL_FOR_EDIT:
        raise HTTPException(status_code=403, detail="Cannot verify approved or cancelled items.")
    if row.status not in ("pending", "scheduled", "in_progress"):
        raise HTTPException(status_code=400, detail="Item must be pending or in progress to verify.")

    row.verification_result = payload.verification_result
    if payload.verification_result == "pass":
        row.status = "completed"
    else:
        row.status = "in_progress"
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="verify",
        resource="process_checklist_item",
        resource_id=row.id,
        details=f"{row.checklist_code} verification {payload.verification_result}",
    )
    db.commit()
    db.refresh(row)
    return row


def approve_item(
    db: Session, tenant_id: int, user: User, item_id: int, payload: ProcessChecklistItemApproval
) -> ProcessChecklistItem:
    if not _can_approve(user):
        raise HTTPException(status_code=403, detail="Approval requires manager, quality, or admin access.")

    row = get_item(db, tenant_id, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    if row.status != "completed":
        raise HTTPException(status_code=400, detail="Only completed items can be approved or rejected.")
    if (row.verification_result or "").lower() != "pass":
        raise HTTPException(status_code=400, detail="Verification must pass before approval.")

    if not payload.approved and not (payload.rejection_reason or "").strip():
        raise HTTPException(status_code=400, detail="rejection_reason required when rejecting.")

    if payload.approved:
        row.status = "approved"
        row.approved_at = _utcnow()
        row.approved_by_name = user.full_name or user.email
        details = f"Approved {row.checklist_code}"
    else:
        row.status = "pending"
        row.approved_at = None
        row.approved_by_name = None
        row.verification_result = "pending"
        details = f"Rejected {row.checklist_code}: {payload.rejection_reason or 'no reason'}"

    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="approve" if payload.approved else "reject",
        resource="process_checklist_item",
        resource_id=row.id,
        details=details,
    )
    db.commit()
    db.refresh(row)
    return row


def transition_item_status(
    db: Session, tenant_id: int, user: User, item_id: int, payload: ProcessChecklistItemStatusChange
) -> ProcessChecklistItem:
    row = get_item(db, tenant_id, item_id)
    if not row:
        raise HTTPException(status_code=404, detail="Checklist item not found.")
    if not _can_work_checklist(user, row):
        raise HTTPException(status_code=403, detail="Not authorized to change status on this checklist item.")

    new_status = payload.status
    current = row.status
    if new_status == current:
        return row

    allowed = ALLOWED_TRANSITIONS.get(current, frozenset())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from '{current}' to '{new_status}'.",
        )

    if new_status == "approved":
        raise HTTPException(status_code=400, detail="Use the approve endpoint for approval.")

    if current == "approved" and new_status == "pending":
        if not _can_approve(user):
            raise HTTPException(status_code=403, detail="Reopening approved items requires manager access.")
        row.approved_at = None
        row.approved_by_name = None

    row.status = new_status
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="status_change",
        resource="process_checklist_item",
        resource_id=row.id,
        details=f"{row.checklist_code}: {current} -> {new_status}",
    )
    db.commit()
    db.refresh(row)
    return row
