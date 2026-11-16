"""Operator 'assigned to me' scope — reuses work-order scoping and warehouse access."""

from __future__ import annotations

from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.machine import Machine, MachineStatusEvent
from app.models.production import WorkOrder
from app.models.user import User
from app.services.data_scope import operator_can_access_work_order, scope_work_orders
from app.services.reports.scope import resolve_accessible_warehouse_ids


def normalized_role_names(user: User) -> set[str]:
    return {r.strip().lower() for r in get_role_names(user) if r and str(r).strip()}


def user_is_operator_role(user: User) -> bool:
    """Exact role name Operator. A name that merely contains the word does not match."""
    if user_is_admin(user):
        return False
    return "operator" in normalized_role_names(user)


def is_shop_floor_operator(user: User) -> bool:
    """Lock down only when Operator is the user's shop-floor role.

    A second role whose name is in the permission matrix (Production Manager, Store
    Manager, and the rest) keeps that role's access. Extra permissions outside the
    Operator set do the same. Matching is the full role name, not a substring.
    """
    if not user or user_is_admin(user):
        return False
    from app.core.permissions import get_user_permissions
    from app.core.rbac_constants import PERMISSION_MATRIX

    names = normalized_role_names(user)
    if "operator" not in names:
        return False
    privileged = {name.strip().lower() for name in PERMISSION_MATRIX if name.strip().lower() != "operator"}
    if names & privileged:
        return False
    operator_spec = PERMISSION_MATRIX.get("Operator") or {}
    allowed = set(operator_spec.get("modules") or []) | set(operator_spec.get("actions") or [])
    extra = {perm for perm in get_user_permissions(user) if perm not in allowed and perm not in {"*", "admin"}}
    return not extra


def resolve_operator_machine_ids(db: Session, user: User) -> list[int]:
    """Machines assigned directly or through an active work order for this operator."""
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

    work_order_machine_ids = db.scalars(
        select(WorkOrder.machine_id).where(
            WorkOrder.tenant_id == user.tenant_id,
            WorkOrder.assigned_user_id == user.id,
            WorkOrder.machine_id.is_not(None),
            func.lower(WorkOrder.status).notin_(("completed", "closed", "done", "cancelled", "canceled")),
        )
    ).all()
    ids.update(int(i) for i in work_order_machine_ids if i is not None)
    return sorted(ids)


def resolve_operator_warehouse_ids(db: Session, user: User) -> list[int]:
    return resolve_accessible_warehouse_ids(db, user.tenant_id, user, None)


def scope_work_orders_for_operator(stmt: Select, user: User, db: Session) -> Select:
    """Session-only work order filter (ignores client-supplied ids)."""
    extra = resolve_operator_machine_ids(db, user) if user_is_operator_role(user) else None
    return scope_work_orders(stmt, user, extra_machine_ids=extra or None)


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


def operator_assigned_work_order_ids(db: Session, user: User):
    stmt = select(WorkOrder.id).where(WorkOrder.tenant_id == user.tenant_id)
    return scope_work_orders_for_operator(stmt, user, db)


def operator_owns_sales_order(db: Session, user: User, sales_order_id: int) -> bool:
    from app.models.production import ProductionOrder

    stmt = (
        select(WorkOrder.id)
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .where(
            WorkOrder.tenant_id == user.tenant_id,
            ProductionOrder.sales_order_id == sales_order_id,
        )
    )
    stmt = scope_work_orders_for_operator(stmt, user, db)
    return db.scalar(stmt) is not None


def apply_operator_document_scope(stmt, db: Session, user: User):
    """Keep documents that reference this operator's work orders, products, or sales orders."""
    from sqlalchemy import and_, func, or_

    from app.models.document import Document
    from app.models.production import ProductionOrder

    if not is_shop_floor_operator(user):
        return stmt
    wo_ids = operator_assigned_work_order_ids(db, user)
    product_ids = (
        select(ProductionOrder.product_id)
        .join(WorkOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .where(WorkOrder.id.in_(wo_ids), ProductionOrder.product_id.is_not(None))
    )
    sales_ids = (
        select(ProductionOrder.sales_order_id)
        .join(WorkOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .where(WorkOrder.id.in_(wo_ids), ProductionOrder.sales_order_id.is_not(None))
    )
    ref = func.lower(Document.reference_type)
    return stmt.where(
        or_(
            and_(ref.in_(("work_order", "workorder")), Document.reference_id.in_(wo_ids)),
            and_(ref == "product", Document.reference_id.in_(product_ids)),
            and_(ref.in_(("sales_order", "salesorder")), Document.reference_id.in_(sales_ids)),
        )
    )


def operator_can_see_alert(db: Session, user: User, alert) -> bool:
    """Operator sees an alert only when it is aimed at them, created by them, or tied to their work."""
    creator_names = {
        str(name).strip().lower()
        for name in (user.full_name, getattr(user, "name", None), user.email)
        if name
    }
    creator = str(getattr(alert, "created_by", None) or "").strip().lower()
    if creator and creator in creator_names:
        return True
    targets = {
        part.strip().lower()
        for part in str(getattr(alert, "target_role", None) or "").split(",")
        if part.strip()
    }
    if "operator" in targets:
        return True
    ref = str(getattr(alert, "reference_type", None) or "").strip().lower()
    ref_id = getattr(alert, "reference_id", None)
    if ref_id is None:
        return False
    if ref in {"machine", "machines"}:
        return int(ref_id) in set(resolve_operator_machine_ids(db, user))
    if ref in {"work_order", "workorder"}:
        owned = db.scalars(operator_assigned_work_order_ids(db, user)).all()
        return int(ref_id) in {int(i) for i in owned}
    return False


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


def assert_operator_work_order_access(
    user: User, wo: WorkOrder, db: Session | None = None
) -> None:
    if operator_can_access_work_order(user, wo):
        return
    if db is not None and wo.machine_id:
        if wo.machine_id in resolve_operator_machine_ids(db, user):
            return
    from fastapi import HTTPException

    # Another operator's record is hidden (404). A forbidden capability stays 403 elsewhere.
    status_code = 404 if is_shop_floor_operator(user) else 403
    raise HTTPException(status_code=status_code, detail="Work order not found")
