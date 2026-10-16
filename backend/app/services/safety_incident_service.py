"""Tenant-scoped safety incidents with RBAC, workflow, and audit."""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import (
    get_role_names,
    get_user_permissions,
    user_can_action,
    user_has_permission,
    user_is_admin,
)
from app.models.hr import Employee, SafetyIncident
from app.models.user import User
from app.schemas.safety_incident import (
    CLOSED_STATUSES,
    OPEN_STATUSES,
    SafetyIncidentAssign,
    SafetyIncidentCreate,
    SafetyIncidentInvestigationUpdate,
    SafetyIncidentStatusChange,
    SafetyIncidentUpdate,
)
from app.services.audit_service import log_audit

ALLOWED_TRANSITIONS: dict[str, frozenset[str]] = {
    "open": frozenset({"under_investigation", "investigating", "in_progress", "pending", "closed", "resolved"}),
    "under_investigation": frozenset(
        {"open", "investigating", "in_progress", "pending", "resolved", "closed"}
    ),
    "investigating": frozenset(
        {"open", "under_investigation", "in_progress", "pending", "resolved", "closed"}
    ),
    "in_progress": frozenset(
        {"open", "under_investigation", "investigating", "pending", "resolved", "closed"}
    ),
    "pending": frozenset(
        {"open", "under_investigation", "investigating", "in_progress", "resolved", "closed"}
    ),
    "resolved": frozenset({"closed", "under_investigation"}),
    "closed": frozenset({"open", "under_investigation"}),
}

SAFETY_ROLE_TOKENS = ("safety", "ehs", "quality", "hse")


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _role_names_lower(user: User) -> set[str]:
    return {r.lower() for r in get_role_names(user) if r}


def _is_safety_or_quality_role(user: User) -> bool:
    if user_is_admin(user):
        return True
    roles = _role_names_lower(user)
    return any(any(tok in r for tok in SAFETY_ROLE_TOKENS) for r in roles)


def _is_supervisor_role(user: User) -> bool:
    roles = _role_names_lower(user)
    return any("supervisor" in r or "manager" in r for r in roles)


def _user_employee_department(db: Session, user: User) -> str | None:
    code = (user.employee_id or "").strip()
    if not code:
        return None
    emp = db.scalars(
        select(Employee).where(
            Employee.tenant_id == user.tenant_id,
            Employee.employee_code == code,
        )
    ).first()
    if not emp or not emp.department:
        return None
    return emp.department.strip()


def _production_elevated(user: User) -> bool:
    perms = get_user_permissions(user)
    if "production:*" in perms or "production:update" in perms:
        return True
    roles = _role_names_lower(user)
    return any("manager" in r or "admin" in r for r in roles)


def can_view_all_incidents(user: User) -> bool:
    if user_is_admin(user):
        return True
    if user_has_permission(user, "hr"):
        return True
    if _is_safety_or_quality_role(user):
        return True
    if user_has_permission(user, "production") and _production_elevated(user):
        return True
    return False


def can_view_incident(db: Session, user: User, incident: SafetyIncident) -> bool:
    if incident.tenant_id != user.tenant_id:
        return False
    if can_view_all_incidents(user):
        return True
    if incident.reported_by_user_id and incident.reported_by_user_id == user.id:
        return True
    if _is_supervisor_role(user) and (
        user_has_permission(user, "hr") or user_has_permission(user, "production")
    ):
        dept = _user_employee_department(db, user)
        if dept and incident.department and incident.department.strip().lower() == dept.lower():
            return True
    return False


def assert_can_view(db: Session, user: User, incident: SafetyIncident) -> None:
    if not can_view_incident(db, user, incident):
        raise HTTPException(status_code=403, detail="Not authorized to view this incident.")


def can_manage_incidents(user: User) -> bool:
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if user_has_permission(user, "hr") and (
        "hr:update" in perms or "hr:*" in perms or user_can_action(user, "hr", "update")
    ):
        return True
    if _is_safety_or_quality_role(user):
        return True
    if user_has_permission(user, "production") and _production_elevated(user):
        return True
    return False


def can_create_incident(user: User) -> bool:
    if user_is_admin(user):
        return True
    perms = get_user_permissions(user)
    if user_has_permission(user, "hr") and (
        "hr:create" in perms or "hr:*" in perms or user_can_action(user, "hr", "create")
    ):
        return True
    if _is_safety_or_quality_role(user):
        return True
    if "production:create" in perms or "production:*" in perms:
        return True
    if user_has_permission(user, "production") and _production_elevated(user):
        return True
    return False


def can_investigate(user: User) -> bool:
    return can_manage_incidents(user)


def can_assign_investigation(user: User) -> bool:
    return can_manage_incidents(user)


def can_close_incident(user: User) -> bool:
    return can_manage_incidents(user)


def _can_reopen(user: User) -> bool:
    if user_is_admin(user):
        return True
    roles = _role_names_lower(user)
    return any("manager" in r or "admin" in r for r in roles) or _is_safety_or_quality_role(user)


def incident_to_register_row(incident: SafetyIncident) -> dict:
    return {
        "id": incident.incident_code,
        "date": incident.incident_date.strftime("%d-%b") if incident.incident_date else "—",
        "dept": incident.department or "—",
        "type": incident.type or incident.title,
        "severity": (incident.severity or "low").lower(),
        "status": (incident.status or "open").lower(),
    }


def aggregate_incident_metrics(incidents: list[SafetyIncident]) -> dict:
    open_inv = sum(1 for i in incidents if (i.status or "").lower() in OPEN_STATUSES)
    closed = sum(1 for i in incidents if (i.status or "").lower() in CLOSED_STATUSES)
    near_miss = sum(1 for i in incidents if i.type and "near" in i.type.lower())
    high_sev = sum(
        1 for i in incidents if (i.severity or "").lower() in ("high", "critical", "major")
    )
    lost_time = sum(1 for i in incidents if i.type and "lost" in i.type.lower())
    capa_completed = sum(
        1 for i in incidents if (i.corrective_action_status or "").lower() == "completed"
    )
    capa_pending = sum(
        1
        for i in incidents
        if (i.corrective_action_status or "").lower() == "pending"
        or (
            i.corrective_action
            and (i.corrective_action_status or "").lower() not in ("completed", "not_required")
        )
    )
    capa_available = any(
        i.corrective_action_status is not None or (i.corrective_action or "").strip()
        for i in incidents
    )
    return {
        "total": len(incidents),
        "open_investigations": open_inv,
        "closed": closed,
        "near_miss": near_miss,
        "high_severity": high_sev,
        "lost_time": lost_time,
        "capa_completed": capa_completed if capa_available else None,
        "capa_pending": capa_pending if capa_available else None,
        "capa_kpi_available": capa_available,
    }


def _next_incident_code(db: Session, tenant_id: int) -> str:
    year = date.today().year
    prefix = f"INC-{year}-"
    count = (
        db.scalar(
            select(func.count())
            .select_from(SafetyIncident)
            .where(
                SafetyIncident.tenant_id == tenant_id,
                SafetyIncident.incident_code.like(f"{prefix}%"),
            )
        )
        or 0
    )
    return f"{prefix}{count + 1:04d}"


def get_incident(db: Session, tenant_id: int, incident_id: int) -> SafetyIncident | None:
    return db.scalars(
        select(SafetyIncident).where(
            SafetyIncident.id == incident_id,
            SafetyIncident.tenant_id == tenant_id,
        )
    ).first()


def _visibility_filter(db: Session, user: User):
    if can_view_all_incidents(user):
        return None
    dept = _user_employee_department(db, user)
    if _is_supervisor_role(user) and dept and (
        user_has_permission(user, "hr") or user_has_permission(user, "production")
    ):
        return or_(
            SafetyIncident.reported_by_user_id == user.id,
            SafetyIncident.department.ilike(dept),
        )
    return SafetyIncident.reported_by_user_id == user.id


def list_incidents(
    db: Session,
    tenant_id: int,
    user: User,
    *,
    page: int = 1,
    page_size: int = 25,
    sort_by: str = "incident_date",
    sort_dir: str = "desc",
    search: str | None = None,
    department: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    incident_type: str | None = None,
    investigation_owner: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    open_only: bool = False,
) -> tuple[list[SafetyIncident], int]:
    if not can_view_all_incidents(user):
        vis = _visibility_filter(db, user)
        if vis is None:
            raise HTTPException(status_code=403, detail="Not authorized to list incidents.")
    else:
        vis = None

    stmt = select(SafetyIncident).where(SafetyIncident.tenant_id == tenant_id)
    if vis is not None:
        stmt = stmt.where(vis)
    if search:
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                SafetyIncident.title.ilike(q),
                SafetyIncident.incident_code.ilike(q),
                SafetyIncident.description.ilike(q),
            )
        )
    if department:
        stmt = stmt.where(SafetyIncident.department.ilike(f"%{department.strip()}%"))
    if severity:
        stmt = stmt.where(SafetyIncident.severity == severity.strip().lower())
    if status:
        stmt = stmt.where(SafetyIncident.status == status.strip().lower())
    if incident_type:
        stmt = stmt.where(SafetyIncident.type.ilike(f"%{incident_type.strip()}%"))
    if investigation_owner:
        stmt = stmt.where(
            SafetyIncident.investigation_owner_name.ilike(f"%{investigation_owner.strip()}%")
        )
    if date_from:
        stmt = stmt.where(SafetyIncident.incident_date >= date_from)
    if date_to:
        stmt = stmt.where(SafetyIncident.incident_date <= date_to)
    if open_only:
        stmt = stmt.where(SafetyIncident.status.in_(tuple(OPEN_STATUSES)))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = int(db.scalar(count_stmt) or 0)

    sort_columns = {
        "incident_date": SafetyIncident.incident_date,
        "severity": SafetyIncident.severity,
        "status": SafetyIncident.status,
        "created_at": SafetyIncident.created_at,
        "incident_code": SafetyIncident.incident_code,
    }
    col = sort_columns.get(sort_by, SafetyIncident.incident_date)
    stmt = stmt.order_by(col.desc() if sort_dir.lower() == "desc" else col.asc())
    page = max(1, page)
    page_size = min(max(1, page_size), 500)
    rows = list(db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all())
    return rows, total


def create_incident(
    db: Session,
    tenant_id: int,
    user: User,
    payload: SafetyIncidentCreate,
    *,
    allow_self_report: bool = False,
) -> SafetyIncident:
    if not allow_self_report and not can_create_incident(user):
        raise HTTPException(status_code=403, detail="Not authorized to create incidents.")
    code = (payload.incident_code or "").strip() or _next_incident_code(db, tenant_id)
    existing = db.scalars(
        select(SafetyIncident).where(
            SafetyIncident.tenant_id == tenant_id,
            SafetyIncident.incident_code == code,
        )
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Incident code already exists for this tenant.")

    row = SafetyIncident(
        tenant_id=tenant_id,
        incident_code=code,
        title=payload.title,
        type=payload.type,
        reporter=payload.reporter or user.full_name or user.email,
        incident_date=payload.incident_date or date.today(),
        severity=payload.severity,
        status=payload.status,
        description=payload.description,
        department=payload.department,
        immediate_action=payload.immediate_action,
        reported_by_user_id=user.id,
        created_by_user_id=user.id,
    )
    db.add(row)
    db.flush()
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="create",
        resource="safety_incident",
        resource_id=row.id,
        details=f"Created safety incident {code}",
    )
    db.commit()
    db.refresh(row)
    return row


def update_incident(
    db: Session,
    tenant_id: int,
    user: User,
    incident_id: int,
    payload: SafetyIncidentUpdate,
) -> SafetyIncident:
    row = get_incident(db, tenant_id, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
    assert_can_view(db, user, row)
    if (row.status or "").lower() in CLOSED_STATUSES and not _can_reopen(user):
        raise HTTPException(status_code=403, detail="Incident is closed; reopen before editing.")
    if not can_manage_incidents(user) and row.reported_by_user_id != user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this incident.")
    if row.reported_by_user_id == user.id and not can_manage_incidents(user):
        allowed_fields = {"description", "immediate_action"}
        data = payload.model_dump(exclude_unset=True)
        if set(data.keys()) - allowed_fields:
            raise HTTPException(
                status_code=403,
                detail="Reporters may only update description and immediate action.",
            )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="update",
        resource="safety_incident",
        resource_id=row.id,
        details=f"Updated incident {row.incident_code}",
    )
    db.commit()
    db.refresh(row)
    return row


def assign_investigation(
    db: Session,
    tenant_id: int,
    user: User,
    incident_id: int,
    payload: SafetyIncidentAssign,
) -> SafetyIncident:
    if not can_assign_investigation(user):
        raise HTTPException(status_code=403, detail="Not authorized to assign investigation owner.")
    row = get_incident(db, tenant_id, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
    assert_can_view(db, user, row)
    if (row.status or "").lower() in CLOSED_STATUSES:
        raise HTTPException(status_code=400, detail="Cannot assign owner on a closed incident.")
    row.investigation_owner_name = payload.investigation_owner_name
    if (row.status or "").lower() == "open":
        row.status = "under_investigation"
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="assign",
        resource="safety_incident",
        resource_id=row.id,
        details=f"Assigned investigation for {row.incident_code} to {payload.investigation_owner_name}",
    )
    db.commit()
    db.refresh(row)
    return row


def update_investigation(
    db: Session,
    tenant_id: int,
    user: User,
    incident_id: int,
    payload: SafetyIncidentInvestigationUpdate,
) -> SafetyIncident:
    if not can_investigate(user):
        raise HTTPException(status_code=403, detail="Not authorized to record investigation details.")
    row = get_incident(db, tenant_id, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
    assert_can_view(db, user, row)
    if (row.status or "").lower() in CLOSED_STATUSES:
        raise HTTPException(status_code=400, detail="Cannot update investigation on a closed incident.")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(row, field, value)
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="investigate",
        resource="safety_incident",
        resource_id=row.id,
        details=f"Updated investigation for {row.incident_code}",
    )
    db.commit()
    db.refresh(row)
    return row


def transition_incident_status(
    db: Session,
    tenant_id: int,
    user: User,
    incident_id: int,
    payload: SafetyIncidentStatusChange,
) -> SafetyIncident:
    row = get_incident(db, tenant_id, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
    assert_can_view(db, user, row)

    new_status = payload.status
    current = (row.status or "open").lower()
    if new_status == current:
        return row

    allowed = ALLOWED_TRANSITIONS.get(current, frozenset())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status transition from '{current}' to '{new_status}'.",
        )

    if current in CLOSED_STATUSES and new_status in OPEN_STATUSES:
        if not _can_reopen(user):
            raise HTTPException(status_code=403, detail="Reopening incidents requires manager or safety access.")

    if new_status in CLOSED_STATUSES:
        if not can_close_incident(user):
            raise HTTPException(status_code=403, detail="Not authorized to close incidents.")
        if not payload.closure_evidence and not row.closure_evidence:
            raise HTTPException(
                status_code=400,
                detail="closure_evidence required when closing an incident.",
            )
        row.closure_evidence = payload.closure_evidence or row.closure_evidence
        row.closed_at = _utcnow()
    elif new_status in OPEN_STATUSES and current in CLOSED_STATUSES:
        row.closed_at = None

    row.status = new_status
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="status",
        resource="safety_incident",
        resource_id=row.id,
        details=f"Incident {row.incident_code} status {current} -> {new_status}",
    )
    db.commit()
    db.refresh(row)
    return row


def delete_incident(db: Session, tenant_id: int, user: User, incident_id: int) -> None:
    if not user_is_admin(user) and not (
        user_has_permission(user, "hr") and user_can_action(user, "hr", "delete")
    ):
        raise HTTPException(status_code=403, detail="Not authorized to delete incidents.")
    row = get_incident(db, tenant_id, incident_id)
    if not row:
        raise HTTPException(status_code=404, detail="Incident not found.")
    log_audit(
        db,
        tenant_id=tenant_id,
        user_id=user.id,
        action="delete",
        resource="safety_incident",
        resource_id=row.id,
        details=f"Deleted incident {row.incident_code}",
    )
    db.delete(row)
    db.commit()
