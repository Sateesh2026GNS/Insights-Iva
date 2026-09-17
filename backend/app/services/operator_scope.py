"""Operator 'assigned to me' scope — reuses work-order scoping and warehouse access."""

from __future__ import annotations

from sqlalchemy import Select, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.machine import Machine, MachineStatusEvent
from app.models.production import WorkOrder
from app.models.user import User
from app.services.data_scope import operator_can_access_work_order, scope_work_orders
from app.services.reports.scope import resolve_accessible_warehouse_ids


def user_is_operator_role(user: User) -> bool:
    if user_is_admin(user):
        return False
    roles = {r.strip().lower() for r in get_role_names(user) if r}
    return "operator" in roles


def resolve_operator_machine_ids(db: Session, user: User) -> list[int]:
    """Machines assigned to this operator (user FK + legacy user.assigned_machine_id)."""
    ids: set[int] = set()
    if user.assigned_machine_id:
        ids.add(int(user.assigned_machine_id))
    rows = db.scalars(
        select(Machine.id).where(
            Machine.tenant_id == user.tenant_id,
            Machine.is_active.is_(True),
            Machine.assigned_operator_id == user.id,
        )
    ).all()
    ids.update(int(i) for i in rows)
    return sorted(ids)


def resolve_operator_warehouse_ids(db: Session, user: User) -> list[int]:
    return resolve_accessible_warehouse_ids(db, user.tenant_id, user, None)


def scope_work_orders_for_operator(stmt: Select, user: User) -> Select:
    """Session-only work order filter (ignores client-supplied ids)."""
    return scope_work_orders(stmt, user)


def operator_machines_query(db: Session, user: User) -> Select:
    machine_ids = resolve_operator_machine_ids(db, user)
    if not machine_ids:
        return select(Machine).where(False)
    return select(Machine).where(
        Machine.tenant_id == user.tenant_id,
        Machine.id.in_(machine_ids),
        Machine.is_active.is_(True),
    )


def recent_machine_status_events(
    db: Session, user: User, machine_id: int, limit: int = 10
) -> list[MachineStatusEvent]:
    machine_ids = resolve_operator_machine_ids(db, user)
    if machine_id not in machine_ids:
        return []
    return list(
        db.scalars(
            select(MachineStatusEvent)
            .where(
                MachineStatusEvent.tenant_id == user.tenant_id,
                MachineStatusEvent.machine_id == machine_id,
            )
            .order_by(MachineStatusEvent.started_at.desc())
            .limit(limit)
        ).all()
    )


def current_work_order_for_machine(db: Session, tenant_id: int, machine_id: int) -> WorkOrder | None:
    return db.scalars(
        select(WorkOrder)
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.machine_id == machine_id,
            WorkOrder.status.notin_(("completed", "closed", "cancelled", "done")),
        )
        .order_by(WorkOrder.id.desc())
    ).first()


def assert_operator_work_order_access(user: User, wo: WorkOrder) -> None:
    if not operator_can_access_work_order(user, wo):
        from fastapi import HTTPException

        raise HTTPException(status_code=403, detail="Work order not in your assignment scope")
