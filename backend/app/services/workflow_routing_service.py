"""Centralized manufacturing workflow routing — single source of truth.

Maps workflow statuses → responsible teams/roles, next stages, and actionable queues.
Canonical backend status names are used throughout; STAGE_ALIASES documents user-facing synonyms.
"""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.permissions import get_role_names, user_is_admin
from app.core.workflow_constants import (
    TEAM_ADMIN,
    TEAM_BILLING,
    TEAM_INVENTORY,
    TEAM_OPERATOR,
    TEAM_PACKING,
    TEAM_PRODUCTION,
    TEAM_QUALITY,
    TEAM_SALES,
    WORKFLOW_COUNT_BUCKETS,
    normalize_priority,
    user_teams,
    workflow_status_label,
)
from app.models.manufacturing_workflow import (
    ManufacturingWorkflowTransition,
    SalesJobCard,
    SalesOrderMaterialCheck,
)
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.sales import SalesOrder
from app.models.user import User

# User-facing synonyms → canonical workflow_status (documentation + normalization)
STAGE_ALIASES: dict[str, str] = {
    "INVENTORY_CHECK_PENDING": "MATERIAL_CHECK_PENDING",
    "INVENTORY_APPROVED": "MATERIAL_AVAILABLE",
    "PRODUCTION_PENDING": "READY_FOR_PRODUCTION",
    "OPERATOR_PENDING": "PRODUCTION_ASSIGNED",
    "QUALITY_PENDING": "QUALITY_CHECK_PENDING",
    "PACKING_DISPATCH_PENDING": "PACKING_PENDING",
}

# ERP role responsible for acting on a status (primary owner)
RESPONSIBLE_ROLE_BY_STATUS: dict[str, str] = {
    "SALES_CONFIRMED": "Sales Manager",
    "MATERIAL_CHECK_PENDING": "Store Manager",
    "MATERIAL_SHORTAGE": "Store Manager",
    "MATERIAL_PARTIAL": "Store Manager",
    "MATERIAL_AVAILABLE": "Store Manager",
    "STORE_ISSUE_PENDING": "Store Manager",
    "STORE_ISSUE_PARTIAL": "Store Manager",
    "READY_FOR_PRODUCTION": "Production Manager",
    "PRODUCTION_ASSIGNED": "Operator",
    "PRODUCTION_IN_PROGRESS": "Operator",
    "PRODUCTION_COMPLETED": "Production Manager",
    "PRODUCTION_REWORK": "Production Manager",
    "QUALITY_CHECK_PENDING": "Production Manager",
    "QUALITY_ON_HOLD": "Production Manager",
    "QUALITY_APPROVED": "Store Manager",
    "QUALITY_REJECTED": "Production Manager",
    "PACKING_PENDING": "Store Manager",
    "PACKING_IN_PROGRESS": "Store Manager",
    "PACKING_ISSUE": "Store Manager",
    "PACKED": "Store Manager",
    "BILLING_PENDING": "Accountant",
    "BILLING_HOLD": "Accountant",
    "INVOICED": "Accountant",
    "COMPLETED": "Admin",
    "WORKFLOW_ON_HOLD": "Admin",
}

RESPONSIBLE_TEAM_BY_STATUS: dict[str, str] = {
    "SALES_CONFIRMED": TEAM_SALES,
    "MATERIAL_CHECK_PENDING": TEAM_INVENTORY,
    "MATERIAL_SHORTAGE": TEAM_INVENTORY,
    "MATERIAL_PARTIAL": TEAM_INVENTORY,
    "MATERIAL_AVAILABLE": TEAM_INVENTORY,
    "STORE_ISSUE_PENDING": TEAM_INVENTORY,
    "STORE_ISSUE_PARTIAL": TEAM_INVENTORY,
    "READY_FOR_PRODUCTION": TEAM_PRODUCTION,
    "PRODUCTION_ASSIGNED": TEAM_OPERATOR,
    "PRODUCTION_IN_PROGRESS": TEAM_OPERATOR,
    "PRODUCTION_COMPLETED": TEAM_PRODUCTION,
    "PRODUCTION_REWORK": TEAM_PRODUCTION,
    "QUALITY_CHECK_PENDING": TEAM_QUALITY,
    "QUALITY_ON_HOLD": TEAM_QUALITY,
    "QUALITY_APPROVED": TEAM_PACKING,
    "QUALITY_REJECTED": TEAM_PRODUCTION,
    "PACKING_PENDING": TEAM_PACKING,
    "PACKING_IN_PROGRESS": TEAM_PACKING,
    "PACKING_ISSUE": TEAM_PACKING,
    "PACKED": TEAM_PACKING,
    "BILLING_PENDING": TEAM_BILLING,
    "BILLING_HOLD": TEAM_BILLING,
    "INVOICED": TEAM_BILLING,
    "COMPLETED": TEAM_ADMIN,
    "WORKFLOW_ON_HOLD": TEAM_ADMIN,
}

# Statuses that require action from each team (strict my-queue filtering)
ACTIONABLE_STATUSES_BY_TEAM: dict[str, frozenset[str]] = {
    TEAM_SALES: frozenset({"SALES_CONFIRMED"}),
    TEAM_INVENTORY: frozenset({
        "MATERIAL_CHECK_PENDING",
        "MATERIAL_SHORTAGE",
        "MATERIAL_PARTIAL",
        "STORE_ISSUE_PENDING",
        "STORE_ISSUE_PARTIAL",
    }),
    TEAM_PRODUCTION: frozenset({
        "READY_FOR_PRODUCTION",
        "PRODUCTION_REWORK",
        "QUALITY_REJECTED",
    }),
    TEAM_OPERATOR: frozenset({"PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"}),
    TEAM_QUALITY: frozenset({"QUALITY_CHECK_PENDING", "QUALITY_ON_HOLD"}),
    TEAM_PACKING: frozenset({"PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKING_ISSUE"}),
    TEAM_BILLING: frozenset({"BILLING_PENDING", "BILLING_HOLD", "PACKED"}),
}

# Happy-path automatic routing after stage completion
NEXT_STATUS_AFTER_ACTION: dict[str, str] = {
    "SALES_CONFIRMED": "MATERIAL_CHECK_PENDING",
    "MATERIAL_AVAILABLE": "STORE_ISSUE_PENDING",
    "STORE_ISSUE_PENDING": "READY_FOR_PRODUCTION",
    "READY_FOR_PRODUCTION": "PRODUCTION_ASSIGNED",
    "PRODUCTION_COMPLETED": "QUALITY_CHECK_PENDING",
    "QUALITY_APPROVED": "PACKING_PENDING",
    "PACKED": "BILLING_PENDING",
    "INVOICED": "COMPLETED",
}

PRIMARY_ROLE_LABEL: dict[str, str] = {
    TEAM_SALES: "Sales Manager",
    TEAM_INVENTORY: "Store Manager",
    TEAM_PRODUCTION: "Production Manager",
    TEAM_OPERATOR: "Operator",
    TEAM_QUALITY: "Quality Team",
    TEAM_PACKING: "Packing & Dispatch",
    TEAM_BILLING: "Billing",
    TEAM_ADMIN: "Admin",
}


def normalize_workflow_status(status: str | None) -> str | None:
    if not status:
        return None
    key = status.strip().upper()
    return STAGE_ALIASES.get(key, key)


def get_responsible_team(status: str | None) -> str | None:
    return RESPONSIBLE_TEAM_BY_STATUS.get(normalize_workflow_status(status) or "")


def get_responsible_role(status: str | None) -> str | None:
    return RESPONSIBLE_ROLE_BY_STATUS.get(normalize_workflow_status(status) or "")


def get_next_workflow_status(current_status: str | None, *, action: str | None = None) -> str | None:
    """Return the canonical next status on the happy path after a stage completes."""
    key = normalize_workflow_status(current_status)
    if not key:
        return "MATERIAL_CHECK_PENDING" if action == "confirm" else None
    if action == "confirm" and key in {"draft", "SALES_CONFIRMED"}:
        return "MATERIAL_CHECK_PENDING"
    return NEXT_STATUS_AFTER_ACTION.get(key)


def get_actionable_statuses_for_user(user: User, *, strict: bool = True) -> set[str]:
    """Statuses the user should see in their my-queue (backend-only filtering)."""
    if user_is_admin(user):
        return set()  # admin uses broad query unless status_filter provided

    teams = user_teams(get_role_names(user))
    allowed: set[str] = set()
    for team in teams:
        bucket = ACTIONABLE_STATUSES_BY_TEAM.get(team, frozenset())
        if strict:
            allowed.update(bucket)
        else:
            # Legacy broad visibility for /queue backward compatibility
            allowed.update(_legacy_team_statuses().get(team, set()))
    return allowed


def _legacy_team_statuses() -> dict[str, set[str]]:
    return {
        TEAM_SALES: {"SALES_CONFIRMED"},
        TEAM_INVENTORY: {
            "MATERIAL_CHECK_PENDING",
            "MATERIAL_SHORTAGE",
            "MATERIAL_PARTIAL",
            "MATERIAL_AVAILABLE",
            "STORE_ISSUE_PENDING",
            "STORE_ISSUE_PARTIAL",
        },
        TEAM_PRODUCTION: {
            "READY_FOR_PRODUCTION",
            "PRODUCTION_ASSIGNED",
            "PRODUCTION_IN_PROGRESS",
            "PRODUCTION_COMPLETED",
            "PRODUCTION_REWORK",
            "QUALITY_REJECTED",
        },
        TEAM_OPERATOR: {"PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"},
        TEAM_QUALITY: {"QUALITY_CHECK_PENDING", "QUALITY_ON_HOLD", "QUALITY_REJECTED"},
        TEAM_PACKING: {"QUALITY_APPROVED", "PACKING_PENDING", "PACKING_IN_PROGRESS", "PACKING_ISSUE"},
        TEAM_BILLING: {"BILLING_PENDING", "BILLING_HOLD", "PACKED"},
    }


def get_primary_team_for_user(user: User) -> str | None:
    teams = user_teams(get_role_names(user))
    if user_is_admin(user):
        return TEAM_ADMIN
    priority = (
        TEAM_INVENTORY,
        TEAM_PRODUCTION,
        TEAM_OPERATOR,
        TEAM_QUALITY,
        TEAM_PACKING,
        TEAM_BILLING,
        TEAM_SALES,
    )
    for team in priority:
        if team in teams:
            return team
    return None


def get_queue_metadata_for_user(user: User) -> dict[str, Any]:
    team = get_primary_team_for_user(user)
    role_names = get_role_names(user)
    primary_role = role_names[0] if role_names else None
    return {
        "primary_team": team,
        "primary_role": primary_role,
        "queue_title": _queue_title_for_user(user, team),
        "actionable_statuses": sorted(get_actionable_statuses_for_user(user, strict=True)),
        "responsible_role_label": PRIMARY_ROLE_LABEL.get(team or "", primary_role or "User"),
    }


def _queue_title_for_user(user: User, team: str | None) -> str:
    if user_is_admin(user):
        return "Manufacturing Workflow — All Stages"
    titles = {
        TEAM_INVENTORY: "Store Manager – Inventory Queue",
        TEAM_PRODUCTION: "Production Manager – Job Card Queue",
        TEAM_OPERATOR: "Operator – My Job Cards",
        TEAM_QUALITY: "Quality – Inspection Queue",
        TEAM_PACKING: "Packing & Dispatch Queue",
        TEAM_BILLING: "Billing Queue",
        TEAM_SALES: "Sales – Order Queue",
    }
    return titles.get(team or "", "My Job Card Queue")


def get_admin_dashboard_counts(db: Session, tenant_id: int, counts_raw: dict[str, int]) -> list[dict[str, Any]]:
    """Admin live counts aligned with workflow stages."""
    buckets = []
    for bucket in WORKFLOW_COUNT_BUCKETS:
        statuses = [s.strip() for s in bucket["statuses"].split(",")]
        total = sum(counts_raw.get(s, 0) for s in statuses)
        buckets.append(
            {
                "key": bucket["key"],
                "label": bucket["label"],
                "count": total,
                "path": bucket["path"],
                "statuses": statuses,
                "responsible_role": get_responsible_role(statuses[0]) if statuses else None,
            }
        )
    return buckets


def _sales_person_matches(user: User, so: SalesOrder) -> bool:
    sp = (so.sales_person or "").strip().lower()
    if not sp:
        return False
    candidates = {
        (user.full_name or "").strip().lower(),
        (user.email or "").strip().lower(),
    }
    return sp in candidates


def _load_received_at_map(
    db: Session, tenant_id: int, order_ids: list[int]
) -> dict[int, str | None]:
    if not order_ids:
        return {}
    rows = db.execute(
        select(
            ManufacturingWorkflowTransition.sales_order_id,
            func.max(ManufacturingWorkflowTransition.created_at),
        )
        .where(
            ManufacturingWorkflowTransition.tenant_id == tenant_id,
            ManufacturingWorkflowTransition.sales_order_id.in_(order_ids),
        )
        .group_by(ManufacturingWorkflowTransition.sales_order_id)
    ).all()
    return {
        so_id: ts.isoformat() if ts else None
        for so_id, ts in rows
    }


def serialize_queue_order(
    db: Session,
    so: SalesOrder,
    *,
    job_card: SalesJobCard | None = None,
    material_check: SalesOrderMaterialCheck | None = None,
    assigned_to: str | None = None,
    received_at: str | None = None,
    work_order_id: int | None = None,
) -> dict[str, Any]:
    from app.services.workflow_team_service import _material_stock_status

    product_name = None
    product_code = None
    qty = None
    unit = None
    product_id = None
    if so.line_items:
        ln = so.line_items[0]
        qty = float(ln.quantity or 0)
        product_name = ln.item_description
        unit = ln.unit or "Nos"
        product_id = ln.product_id
        if ln.product_id:
            p = db.get(Product, ln.product_id)
            if p:
                product_name = p.name or product_name
                product_code = getattr(p, "sku", None) or getattr(p, "code", None)

    if job_card:
        qty = float(job_card.quantity or qty or 0)
        unit = job_card.unit or unit or "Nos"
        if job_card.product_id:
            product_id = job_card.product_id
            p = db.get(Product, job_card.product_id)
            if p:
                product_name = p.name or product_name
                product_code = getattr(p, "sku", None) or getattr(p, "code", None)

    ws = so.workflow_status
    label = workflow_status_label(ws)
    delivery = (
        job_card.required_delivery_date
        if job_card and job_card.required_delivery_date
        else so.delivery_date
    )

    return {
        "sales_order_id": so.id,
        "job_card_id": job_card.id if job_card else None,
        "job_card_no": job_card.job_card_no if job_card else None,
        "order_number": so.order_number,
        "customer_name": so.customer.name if so.customer else None,
        "product_name": product_name,
        "product_code": product_code,
        "product_id": product_id,
        "quantity": qty,
        "unit": unit or "Nos",
        "priority": normalize_priority(job_card.priority if job_card else so.priority),
        "workflow_status": ws,
        "current_stage": ws,
        "status_label": label,
        "status": label,
        "responsible_role": get_responsible_role(ws),
        "responsible_team": get_responsible_team(ws),
        "delivery_date": delivery.isoformat() if delivery else None,
        "order_date": so.order_date.isoformat() if so.order_date else None,
        "sales_person": so.sales_person,
        "material_stock_status": _material_stock_status(ws, material_check),
        "assigned_to": assigned_to,
        "received_at": received_at,
        "work_order_id": work_order_id,
    }


def get_my_job_card_queue(
    db: Session,
    tenant_id: int,
    user: User,
    *,
    status_filter: str | None = None,
    limit: int = 50,
    strict: bool = True,
    include_completed: bool = False,
) -> dict[str, Any]:
    """Return job cards actionable by the current user — backend role filtering only."""
    from app.services.workflow_team_service import repair_confirmed_orders_missing_workflow

    teams = user_teams(get_role_names(user))
    is_admin = user_is_admin(user)

    if TEAM_INVENTORY in teams or is_admin:
        repair_confirmed_orders_missing_workflow(db, tenant_id, user=user)

    metadata = get_queue_metadata_for_user(user)
    allowed = get_actionable_statuses_for_user(user, strict=strict) if not is_admin else set()

    if not strict and not is_admin:
        allowed = get_actionable_statuses_for_user(user, strict=False)

    if status_filter:
        sf = normalize_workflow_status(status_filter) or status_filter.upper()
        if not is_admin and sf not in allowed:
            raise HTTPException(status_code=403, detail="Status not visible to your role")
        allowed = {sf}

    # Operator queue: assignee-scoped via work orders
    if TEAM_OPERATOR in teams and not is_admin and (not status_filter or status_filter.upper() in ACTIONABLE_STATUSES_BY_TEAM[TEAM_OPERATOR]):
        items = _operator_my_queue(db, tenant_id, user, status_filter=status_filter, limit=limit)
        return {"items": items, "meta": metadata, "total": len(items)}

    orders: list[SalesOrder] = []

    if is_admin and not status_filter:
        q = (
            select(SalesOrder)
            .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
            .where(SalesOrder.tenant_id == tenant_id)
        )
        if not include_completed:
            q = q.where(
                or_(
                    SalesOrder.workflow_status.is_(None),
                    SalesOrder.workflow_status != "COMPLETED",
                    SalesOrder.status.in_(["draft", "pending"]),
                )
            )
        orders = list(db.scalars(q.order_by(SalesOrder.id.desc()).limit(limit)).all())
    else:
        if TEAM_SALES in teams and not status_filter:
            draft_q = (
                select(SalesOrder)
                .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
                .where(
                    SalesOrder.tenant_id == tenant_id,
                    SalesOrder.status.in_(["draft", "pending"]),
                    SalesOrder.workflow_status.is_(None),
                )
                .order_by(SalesOrder.id.desc())
                .limit(limit)
            )
            draft_orders = list(db.scalars(draft_q).all())
            if strict and TEAM_SALES in teams:
                draft_orders = [o for o in draft_orders if _sales_person_matches(user, o)]
            orders.extend(draft_orders)

        if allowed:
            wf_q = (
                select(SalesOrder)
                .options(selectinload(SalesOrder.line_items), selectinload(SalesOrder.customer))
                .where(
                    SalesOrder.tenant_id == tenant_id,
                    SalesOrder.workflow_status.in_(list(allowed)),
                )
                .order_by(SalesOrder.id.desc())
                .limit(limit)
            )
            if TEAM_SALES in teams and strict and "SALES_CONFIRMED" in allowed:
                # Sales sees own confirmed orders when strict
                pass  # filtered below after fetch
            wf_orders = list(db.scalars(wf_q).all())
            if TEAM_SALES in teams and strict:
                wf_orders = [
                    o
                    for o in wf_orders
                    if (o.workflow_status or "").upper() != "SALES_CONFIRMED"
                    or _sales_person_matches(user, o)
                ]
            seen = {o.id for o in orders}
            for o in wf_orders:
                if o.id not in seen:
                    orders.append(o)
                    seen.add(o.id)

        orders.sort(key=lambda o: o.id, reverse=True)
        orders = orders[:limit]

    items = _enrich_queue_orders(db, tenant_id, orders)
    return {"items": items, "meta": metadata, "total": len(items)}


def _operator_my_queue(
    db: Session,
    tenant_id: int,
    user: User,
    *,
    status_filter: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    allowed = set(ACTIONABLE_STATUSES_BY_TEAM[TEAM_OPERATOR])
    if status_filter:
        sf = normalize_workflow_status(status_filter) or status_filter.upper()
        if sf not in allowed:
            raise HTTPException(status_code=403, detail="Status not visible to operator")
        allowed = {sf}

    stmt = (
        select(WorkOrder, SalesOrder, ProductionOrder)
        .join(ProductionOrder, WorkOrder.production_order_id == ProductionOrder.id)
        .join(SalesOrder, ProductionOrder.sales_order_id == SalesOrder.id)
        .options(selectinload(SalesOrder.customer), selectinload(SalesOrder.line_items))
        .where(
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.assigned_user_id == user.id,
            SalesOrder.workflow_status.in_(list(allowed)),
        )
        .order_by(SalesOrder.id.desc())
        .limit(limit)
    )
    rows = db.execute(stmt).all()
    orders = [so for _wo, so, _po in rows]
    wo_map = {so.id: wo for wo, so, _po in rows}
    items = _enrich_queue_orders(db, tenant_id, orders)
    for item in items:
        wo = wo_map.get(item["sales_order_id"])
        if wo:
            item["work_order_id"] = wo.id
            item["work_order_status"] = wo.status
    return items


def _enrich_queue_orders(
    db: Session, tenant_id: int, orders: list[SalesOrder]
) -> list[dict[str, Any]]:
    if not orders:
        return []

    order_ids = [o.id for o in orders]
    jc_map: dict[int, SalesJobCard] = {}
    mc_map: dict[int, SalesOrderMaterialCheck] = {}
    assign_map: dict[int, str | None] = {}

    jcs = list(
        db.scalars(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.sales_order_id.in_(order_ids),
            )
        ).all()
    )
    jc_map = {jc.sales_order_id: jc for jc in jcs}

    mcs = list(
        db.scalars(
            select(SalesOrderMaterialCheck)
            .options(selectinload(SalesOrderMaterialCheck.lines))
            .where(
                SalesOrderMaterialCheck.tenant_id == tenant_id,
                SalesOrderMaterialCheck.sales_order_id.in_(order_ids),
            )
        ).all()
    )
    mc_map = {mc.sales_order_id: mc for mc in mcs}

    pos = list(
        db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.sales_order_id.in_(order_ids),
            )
        ).all()
    )
    if pos:
        po_ids = [po.id for po in pos]
        wos = list(
            db.scalars(
                select(WorkOrder).where(
                    WorkOrder.tenant_id == tenant_id,
                    WorkOrder.production_order_id.in_(po_ids),
                    WorkOrder.assigned_user_id.isnot(None),
                )
            ).all()
        )
        user_ids = {wo.assigned_user_id for wo in wos if wo.assigned_user_id}
        user_names: dict[int, str] = {}
        if user_ids:
            for u in db.scalars(select(User).where(User.id.in_(user_ids))).all():
                user_names[u.id] = u.full_name or u.email or f"User #{u.id}"
        po_by_so = {po.sales_order_id: po.id for po in pos}
        for wo in wos:
            for po in pos:
                if po.id == wo.production_order_id and po.sales_order_id:
                    name = wo.operator_name or user_names.get(wo.assigned_user_id or 0)
                    if name:
                        assign_map[po.sales_order_id] = name

    received_map = _load_received_at_map(db, tenant_id, order_ids)

    return [
        serialize_queue_order(
            db,
            so,
            job_card=jc_map.get(so.id),
            material_check=mc_map.get(so.id),
            assigned_to=assign_map.get(so.id),
            received_at=received_map.get(so.id),
        )
        for so in orders
    ]
