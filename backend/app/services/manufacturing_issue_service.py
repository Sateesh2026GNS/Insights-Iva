"""CRUD and workflow for manufacturing_issues (tenant-scoped)."""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.manufacturing_toolkit import ManufacturingIssue
from app.models.user import User
from app.schemas.manufacturing_issue import (
    ManufacturingIssueAssign,
    ManufacturingIssueCreate,
    ManufacturingIssueStatusChange,
    ManufacturingIssueUpdate,
    VALID_PRIORITIES,
    VALID_STATUSES,
)
from app.services.audit_service import log_audit

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "open": frozenset({"in_progress", "on_hold", "closed", "cancelled"}),
    "in_progress": frozenset({"open", "on_hold", "closed", "cancelled"}),
    "on_hold": frozenset({"open", "in_progress", "closed", "cancelled"}),
    "closed": frozenset({"open"}),
    "cancelled": frozenset({"open"}),
}

TERMINAL_STATUSES = frozenset({"closed", "cancelled"})


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _can_reopen(user: User) -> bool:
    if user_is_admin(user):
        return True
    roles = {r.lower() for r in get_role_names(user) if r}
    return any("manager" in r or "admin" in r for r in roles)


def _can_modify_issue(user: User, issue: ManufacturingIssue) -> bool:
    if user_is_admin(user):
        return True
    if issue.status in TERMINAL_STATUSES:
        return _can_reopen(user)
    return True


def issue_to_register_row(issue: ManufacturingIssue) -> dict:
    return {
        "id": issue.issue_code,
        "raised": issue.raised_date.strftime("%d-%b"),
        "dept": issue.department or "—",
        "title": issue.title,
        "priority": issue.priority,
        "owner": issue.owner_name or "—",
        "status": issue.status,
    }


def _next_issue_code(db: Session, tenant_id: int) -> str:
    year = date.today().year
    prefix = f"ISS-{year}-"
    count = (
        db.scalar(
            select(func.count())
            .select_from(ManufacturingIssue)
            .where(
                ManufacturingIssue.tenant_id == tenant_id,
                ManufacturingIssue.issue_code.like(f"{prefix}%"),
            )
        )
        or 0
    )
    return f"{prefix}{count + 1:04d}"


def get_issue(db: Session, tenant_id: int, issue_id: int) -> ManufacturingIssue | None:
    return db.scalars(
        select(ManufacturingIssue).where(
            ManufacturingIssue.id == issue_id,
            ManufacturingIssue.tenant_id == tenant_id,
        )
    ).first()


def list_issues(
    db: Session,
    tenant_id: int,
    *,
    page: int = 1,
    page_size: int = 25,
    sort_by: str = "raised_date",
    sort_dir: str = "desc",
    search: str | None = None,
    department: str | None = None,
    priority: str | None = None,
    status: str | None = None,
    owner_name: str | None = None,
    raised_from: date | None = None,
    raised_to: date | None = None,
) -> tuple[list[ManufacturingIssue], int]:
    stmt = select(ManufacturingIssue).where(ManufacturingIssue.tenant_id == tenant_id)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(ManufacturingIssue.title.ilike(q), ManufacturingIssue.issue_code.ilike(q))
        )
    if department:
        stmt = stmt.where(ManufacturingIssue.department == department)
    if priority:
        stmt = stmt.where(ManufacturingIssue.priority == priority.strip().lower())
    if status:
        stmt = stmt.where(ManufacturingIssue.status == status.strip().lower())
    if owner_name:
        stmt = stmt.where(ManufacturingIssue.owner_name.ilike(f"%{owner_name.strip()}%"))
    if raised_from:
        stmt = stmt.where(ManufacturingIssue.raised_date >= raised_from)
    if raised_to:
        stmt = stmt.where(ManufacturingIssue.raised_date <= raised_to)

    count_stmt = select(func.count()).select_from(ManufacturingIssue).where(
        ManufacturingIssue.tenant_id == tenant_id
    )
    if search:
        q = f"%{search.strip()}%"
        count_stmt = count_stmt.where(
            or_(ManufacturingIssue.title.ilike(q), ManufacturingIssue.issue_code.ilike(q))
        )
    if department:
        count_stmt = count_stmt.where(ManufacturingIssue.department == department)
    if priority:
        count_stmt = count_stmt.where(ManufacturingIssue.priority == priority.strip().lower())
    if status:
        count_stmt = count_stmt.where(ManufacturingIssue.status == status.strip().lower())
    if owner_name:
        count_stmt = count_stmt.where(ManufacturingIssue.owner_name.ilike(f"%{owner_name.strip()}%"))
    if raised_from:
        count_stmt = count_stmt.where(ManufacturingIssue.raised_date >= raised_from)
    if raised_to:
        count_stmt = count_stmt.where(ManufacturingIssue.raised_date <= raised_to)
    total = int(db.scalar(count_stmt) or 0)

    sort_columns = {
        "raised_date": ManufacturingIssue.raised_date,
        "target_date": ManufacturingIssue.target_date,
        "priority": ManufacturingIssue.priority,
        "status": ManufacturingIssue.status,
        "created_at": ManufacturingIssue.created_at,
        "issue_code": ManufacturingIssue.issue_code,
    }
    col = sort_columns.get(sort_by, ManufacturingIssue.raised_date)
    stmt = stmt.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
    page = max(1, page)
    page_size = min(max(1, page_size), 500)
    rows = list(
        db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    )
    return rows, int(total)


def create_issue(
    db: Session,
    tenant_id: int,
    user: User,
    payload: ManufacturingIssueCreate,
) -> ManufacturingIssue:
    code = (payload.issue_code or "").strip() or _next_issue_code(db, tenant_id)
    existing = db.scalars(
        select(ManufacturingIssue).where(
            ManufacturingIssue.tenant_id == tenant_id,
            ManufacturingIssue.issue_code == code,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Issue code already exists for this tenant.")

    row = ManufacturingIssue(
        tenant_id=tenant_id,
        issue_code=code,
        title=payload.title,
        department=payload.department,
        priority=payload.priority,
        owner_name=payload.owner_name,
        status="open",
        raised_date=payload.raised_date or date.today(),
        target_date=payload.target_date,
        resolution_notes=payload.resolution_notes,
        created_by_user_id=user.id,
    )
    db.add(row)
    try:
        db.flush()
        log_audit(
            db,
            tenant_id=tenant_id,
            user_id=user.id,
            action="create",
            resource="manufacturing_issue",
            resource_id=row.id,
            details=f"Created issue {code}",
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Issue code already exists for this tenant.") from None
    db.refresh(row)
    return row


def update_issue(
    db: Session,
    tenant_id: int,
    user: User,
    issue_id: int,
    payload: ManufacturingIssueUpdate,
) -> ManufacturingIssue:
    row = get_issue(db, tenant_id, issue_id)
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if not _can_modify_issue(user, row):
        raise HTTPException(status_code=403, detail="Cannot modify a closed or cancelled issue.")
    if row.status in TERMINAL_STATUSES:
        raise HTTPException(status_code=403, detail="Issue is closed or cancelled; reopen before editing.")

    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(row, field, value)
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="update",
        resource="manufacturing_issue",
        resource_id=row.id,
        details=f"Updated issue {row.issue_code}",
    )
    db.commit()
    db.refresh(row)
    return row


def assign_issue(
    db: Session,
    tenant_id: int,
    user: User,
    issue_id: int,
    payload: ManufacturingIssueAssign,
) -> ManufacturingIssue:
    row = get_issue(db, tenant_id, issue_id)
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found.")
    if row.status in TERMINAL_STATUSES:
        raise HTTPException(status_code=403, detail="Cannot assign owner on a closed or cancelled issue.")
    if not user_is_admin(user) and not _can_modify_issue(user, row):
        raise HTTPException(status_code=403, detail="Not authorized to assign issue owner.")

    row.owner_name = payload.owner_name
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="assign",
        resource="manufacturing_issue",
        resource_id=row.id,
        details=f"Assigned {row.issue_code} to {payload.owner_name}",
    )
    db.commit()
    db.refresh(row)
    return row


def transition_issue_status(
    db: Session,
    tenant_id: int,
    user: User,
    issue_id: int,
    payload: ManufacturingIssueStatusChange,
) -> ManufacturingIssue:
    row = get_issue(db, tenant_id, issue_id)
    if not row:
        raise HTTPException(status_code=404, detail="Issue not found.")

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

    if current in TERMINAL_STATUSES and new_status == "open":
        if not _can_reopen(user):
            raise HTTPException(status_code=403, detail="Reopening issues requires manager or admin access.")

    if new_status == "closed":
        if not payload.resolution_notes and not row.resolution_notes:
            raise HTTPException(
                status_code=400,
                detail="resolution_notes required when closing an issue.",
            )
        row.resolution_notes = payload.resolution_notes or row.resolution_notes
        row.closed_at = _utcnow()
    elif new_status == "open" and current in TERMINAL_STATUSES:
        row.closed_at = None
    if new_status == "cancelled":
        row.closed_at = _utcnow()

    row.status = new_status
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="status_change",
        resource="manufacturing_issue",
        resource_id=row.id,
        details=f"{row.issue_code}: {current} -> {new_status}",
    )
    db.commit()
    db.refresh(row)
    return row
