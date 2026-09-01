"""Workflow stage job cards — linked documents per pipeline stage."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.workflow_constants import normalize_priority
from app.models.manufacturing_workflow import (
    SalesJobCard,
    SalesOrderMaterialCheck,
    SalesOrderMaterialCheckLine,
    WorkflowMaterialIssueLine,
    WorkflowStageJobCard,
)
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.quality import QualityInspection
from app.models.sales import DispatchShipment, Invoice, SalesOrder, SalesOrderLine
from app.models.user import User

STAGE_PREFIX = {
    "inventory_check": "IC",
    "store": "ST",
    "production_manager": "PM",
    "operator": "OP",
    "quality": "QC",
    "packing": "PK",
    "billing": "BL",
}

WORKFLOW_TRACKER_STEPS = [
    {"key": "sales_order", "label": "Sales Order"},
    {"key": "inventory_check", "label": "Inventory Check"},
    {"key": "store_manager", "label": "Store Manager"},
    {"key": "production_manager", "label": "Production Manager"},
    {"key": "operator", "label": "Operator"},
    {"key": "quality_check", "label": "Quality Check"},
    {"key": "packing_dispatch", "label": "Packing & Dispatch"},
    {"key": "billing", "label": "Billing"},
    {"key": "completed", "label": "Completed"},
]

STATUS_TO_TRACKER_INDEX = {
    "SALES_CONFIRMED": 0,
    "MATERIAL_CHECK_PENDING": 1,
    "MATERIAL_AVAILABLE": 1,
    "MATERIAL_SHORTAGE": 1,
    "MATERIAL_PARTIAL": 1,
    "WORKFLOW_ON_HOLD": -1,
    "STORE_ISSUE_PENDING": 2,
    "STORE_ISSUE_PARTIAL": 2,
    "READY_FOR_PRODUCTION": 3,
    "PRODUCTION_ASSIGNED": 4,
    "PRODUCTION_IN_PROGRESS": 4,
    "PRODUCTION_COMPLETED": 4,
    "PRODUCTION_REWORK": 3,
    "QUALITY_CHECK_PENDING": 5,
    "QUALITY_ON_HOLD": 5,
    "QUALITY_REJECTED": 5,
    "QUALITY_APPROVED": 6,
    "PACKING_PENDING": 6,
    "PACKING_IN_PROGRESS": 6,
    "PACKING_ISSUE": 6,
    "PACKED": 7,
    "BILLING_PENDING": 7,
    "BILLING_HOLD": 7,
    "INVOICED": 7,
    "COMPLETED": 8,
}


def _fmt_dt(value: datetime | None) -> str | None:
    if not value:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone().strftime("%d-%b-%Y %I:%M %p")


def _availability_status(required: float, available: float) -> str:
    if available >= required:
        return "Available"
    if available > 0:
        return "Partial"
    return "Not Available"


def _generate_card_number(db: Session, tenant_id: int, prefix: str) -> str:
    year = datetime.now(timezone.utc).year
    full_prefix = f"{prefix}-{year}-"
    existing = list(
        db.scalars(
            select(WorkflowStageJobCard.card_number).where(
                WorkflowStageJobCard.tenant_id == tenant_id,
                WorkflowStageJobCard.card_number.like(f"{full_prefix}%"),
            )
        ).all()
    )
    max_seq = 0
    for no in existing:
        try:
            max_seq = max(max_seq, int(str(no).split("-")[-1]))
        except ValueError:
            continue
    return f"{full_prefix}{max_seq + 1:05d}"


def _get_sales_job_card(db: Session, tenant_id: int, sales_order_id: int) -> SalesJobCard | None:
    return db.scalars(
        select(SalesJobCard).where(
            SalesJobCard.tenant_id == tenant_id,
            SalesJobCard.sales_order_id == sales_order_id,
        )
    ).first()


def get_stage_card(
    db: Session, tenant_id: int, sales_order_id: int, stage: str
) -> WorkflowStageJobCard | None:
    return db.scalars(
        select(WorkflowStageJobCard)
        .options(selectinload(WorkflowStageJobCard.issue_lines))
        .where(
            WorkflowStageJobCard.tenant_id == tenant_id,
            WorkflowStageJobCard.sales_order_id == sales_order_id,
            WorkflowStageJobCard.stage == stage,
        )
    ).first()


def ensure_stage_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage: str,
    *,
    status: str = "pending",
    material_check_id: int | None = None,
    work_order_id: int | None = None,
    quality_inspection_id: int | None = None,
    dispatch_id: int | None = None,
    invoice_id: int | None = None,
    assigned_user_id: int | None = None,
) -> WorkflowStageJobCard:
    existing = get_stage_card(db, tenant_id, sales_order_id, stage)
    if existing:
        if work_order_id and not existing.work_order_id:
            existing.work_order_id = work_order_id
        if quality_inspection_id and not existing.quality_inspection_id:
            existing.quality_inspection_id = quality_inspection_id
        if dispatch_id and not existing.dispatch_id:
            existing.dispatch_id = dispatch_id
        if invoice_id and not existing.invoice_id:
            existing.invoice_id = invoice_id
        if assigned_user_id and not existing.assigned_user_id:
            existing.assigned_user_id = assigned_user_id
        if status != "pending" and existing.status == "pending":
            existing.status = status
        return existing

    prefix = STAGE_PREFIX.get(stage, "WF")
    sjc = _get_sales_job_card(db, tenant_id, sales_order_id)
    card = WorkflowStageJobCard(
        tenant_id=tenant_id,
        sales_order_id=sales_order_id,
        sales_job_card_id=sjc.id if sjc else None,
        stage=stage,
        card_number=_generate_card_number(db, tenant_id, prefix),
        status=status,
        material_check_id=material_check_id,
        work_order_id=work_order_id,
        quality_inspection_id=quality_inspection_id,
        dispatch_id=dispatch_id,
        invoice_id=invoice_id,
        assigned_user_id=assigned_user_id,
    )
    db.add(card)
    db.flush()
    return card


def _ensure_store_issue_lines(
    db: Session, store_card: WorkflowStageJobCard, mc: SalesOrderMaterialCheck
) -> None:
    if store_card.issue_lines:
        return
    for ln in mc.lines or []:
        material_code = None
        if ln.product_id:
            prod = db.get(Product, ln.product_id)
            material_code = prod.sku if prod else None
        required = float(ln.required_qty or 0)
        available = float(ln.available_qty or 0)
        db.add(
            WorkflowMaterialIssueLine(
                stage_job_card_id=store_card.id,
                material_check_line_id=ln.id,
                product_id=ln.product_id,
                material_code=material_code,
                material_name=ln.material_name,
                required_qty=required,
                available_qty=available,
                issued_qty=0,
                remaining_qty=required,
                store_location=ln.stock_location,
                issue_status="pending",
            )
        )
    db.flush()


def _order_context(db: Session, tenant_id: int, sales_order_id: int) -> dict[str, Any]:
    so = db.scalars(
        select(SalesOrder)
        .options(selectinload(SalesOrder.customer), selectinload(SalesOrder.line_items))
        .where(SalesOrder.id == sales_order_id, SalesOrder.tenant_id == tenant_id)
    ).first()
    if not so:
        raise HTTPException(status_code=404, detail="Sales order not found")
    line = so.line_items[0] if so.line_items else None
    product_name = line.item_description if line else None
    product_code = ""
    if line and line.product_id:
        prod = db.get(Product, line.product_id)
        product_name = prod.name if prod else product_name
        product_code = prod.sku if prod else ""
    sjc = _get_sales_job_card(db, tenant_id, sales_order_id)
    return {
        "sales_order": so,
        "line": line,
        "customer_name": so.customer.name if so.customer else None,
        "product_name": product_name,
        "product_code": product_code,
        "quantity": float(sjc.quantity if sjc else (line.quantity if line else 0)),
        "unit": sjc.unit if sjc else (line.unit if line and line.unit else "Nos"),
        "priority": normalize_priority(sjc.priority if sjc else so.priority),
        "delivery_date": (
            sjc.required_delivery_date.isoformat()
            if sjc and sjc.required_delivery_date
            else (so.delivery_date.isoformat() if so.delivery_date else None)
        ),
        "sales_job_card_no": sjc.job_card_no if sjc else None,
        "sales_job_card_id": sjc.id if sjc else None,
        "workflow_status": (so.workflow_status or "").upper(),
    }


def build_workflow_tracker(workflow_status: str | None) -> list[dict[str, Any]]:
    ws = (workflow_status or "SALES_CONFIRMED").upper()
    if ws == "COMPLETED":
        return [
            {**step, "status": "completed"}
            for step in WORKFLOW_TRACKER_STEPS
        ]
    if ws == "WORKFLOW_ON_HOLD":
        idx = STATUS_TO_TRACKER_INDEX.get(ws, 0)
        return _tracker_from_index(max(0, idx), blocked=True)

    idx = STATUS_TO_TRACKER_INDEX.get(ws, 0)
    if ws == "QUALITY_REJECTED":
        return _tracker_from_index(5, rejected=True)
    return _tracker_from_index(idx)


def _tracker_from_index(active_idx: int, *, blocked: bool = False, rejected: bool = False) -> list[dict[str, Any]]:
    out = []
    for i, step in enumerate(WORKFLOW_TRACKER_STEPS):
        if i < active_idx:
            state = "completed"
        elif i == active_idx:
            if rejected:
                state = "rejected"
            elif blocked:
                state = "blocked"
            else:
                state = "current"
        else:
            state = "pending"
        out.append({**step, "status": state})
    return out


def build_stage_job_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage: str,
    user: User | None = None,
) -> dict[str, Any]:
    """Build full stage job card payload (mirrors sales job card shape)."""
    ctx = _order_context(db, tenant_id, sales_order_id)
    so = ctx["sales_order"]
    ws = ctx["workflow_status"]
    stage_card = get_stage_card(db, tenant_id, sales_order_id, stage)
    tracker = build_workflow_tracker(ws)

    base = {
        "stage": stage,
        "sales_order_id": sales_order_id,
        "sales_order_no": so.order_number,
        "sales_job_card_no": ctx["sales_job_card_no"],
        "workflow_status": ws,
        "workflow_tracker": tracker,
        "summary_panel": {
            "job_card_no": stage_card.card_number if stage_card else "—",
            "sales_order_no": so.order_number,
            "customer": ctx["customer_name"],
            "product": ctx["product_name"],
            "order_quantity": ctx["quantity"],
            "required_delivery": ctx["delivery_date"],
            "priority": ctx["priority"],
            "uom": ctx["unit"],
            "workflow_status": ws,
        },
        "priority": ctx["priority"],
        "allowed_actions": _stage_allowed_actions(stage, ws, user),
        "editable": _stage_editable(stage, ws, user),
    }

    if stage == "inventory_check":
        return {**base, **_build_inventory_check(db, tenant_id, sales_order_id, stage_card, ctx)}
    if stage == "store":
        return {**base, **_build_store_card(db, tenant_id, sales_order_id, stage_card, ctx)}
    if stage == "production_manager":
        return {**base, **_build_production_manager_card(db, tenant_id, sales_order_id, stage_card, ctx)}
    if stage == "operator":
        return {**base, **_build_operator_card(db, tenant_id, sales_order_id, stage_card, ctx, user)}
    if stage == "quality":
        return {**base, **_build_quality_card(db, tenant_id, sales_order_id, stage_card, ctx)}
    if stage == "packing":
        return {**base, **_build_packing_card(db, tenant_id, sales_order_id, stage_card, ctx)}
    if stage == "billing":
        return {**base, **_build_billing_card(db, tenant_id, sales_order_id, stage_card, ctx)}
    raise HTTPException(status_code=400, detail=f"Unknown stage: {stage}")


def _stage_editable(stage: str, ws: str, user: User | None) -> bool:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import user_teams

    if not user:
        return False
    if user_is_admin(user):
        return True
    teams = user_teams(get_role_names(user))
    stage_team = {
        "inventory_check": "inventory",
        "store": "inventory",
        "production_manager": "production",
        "operator": "operator",
        "quality": "quality",
        "packing": "packing",
        "billing": "billing",
    }
    required = stage_team.get(stage)
    return bool(required and required in teams)


def _stage_allowed_actions(stage: str, ws: str, user: User | None) -> list[str]:
    if not _stage_editable(stage, ws, user):
        return ["view"]
    actions_map = {
        "inventory_check": {
            "MATERIAL_CHECK_PENDING": ["confirm_inventory", "hold_order", "raise_material_request"],
            "MATERIAL_SHORTAGE": ["hold_order", "raise_material_request"],
            "MATERIAL_PARTIAL": ["hold_order", "raise_material_request"],
        },
        "store": {
            "STORE_ISSUE_PENDING": ["issue_materials", "partial_issue", "hold", "send_to_production"],
            "STORE_ISSUE_PARTIAL": ["issue_materials", "partial_issue", "hold", "send_to_production"],
            "MATERIAL_AVAILABLE": ["issue_materials", "partial_issue", "hold", "send_to_production"],
        },
        "production_manager": {
            "READY_FOR_PRODUCTION": ["create_production_plan", "assign_operator", "hold", "send_to_operator"],
            "PRODUCTION_REWORK": ["assign_operator", "hold", "send_to_operator"],
            "QUALITY_REJECTED": ["assign_operator", "hold", "send_to_operator"],
        },
        "operator": {
            "PRODUCTION_ASSIGNED": ["start_work"],
            "PRODUCTION_IN_PROGRESS": ["pause", "resume", "complete_production", "report_issue"],
        },
        "quality": {
            "QUALITY_CHECK_PENDING": ["approve", "reject", "hold", "send_back_to_production"],
            "QUALITY_ON_HOLD": ["approve", "reject", "send_back_to_production"],
        },
        "packing": {
            "PACKING_PENDING": ["start_packing", "hold"],
            "PACKING_IN_PROGRESS": ["complete_packing", "dispatch", "hold"],
            "QUALITY_APPROVED": ["start_packing", "hold"],
        },
        "billing": {
            "BILLING_PENDING": ["create_invoice", "save_draft", "confirm_billing", "hold"],
            "BILLING_HOLD": ["create_invoice", "confirm_billing"],
            "PACKED": ["create_invoice", "save_draft", "confirm_billing", "hold"],
        },
    }
    return actions_map.get(stage, {}).get(ws, ["view"])


def _build_inventory_check(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
) -> dict[str, Any]:
    mc = db.scalars(
        select(SalesOrderMaterialCheck)
        .options(selectinload(SalesOrderMaterialCheck.lines))
        .where(
            SalesOrderMaterialCheck.sales_order_id == sales_order_id,
            SalesOrderMaterialCheck.tenant_id == tenant_id,
        )
    ).first()
    if mc and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "inventory_check",
            material_check_id=mc.id,
            status="in_progress" if ctx["workflow_status"] == "MATERIAL_CHECK_PENDING" else "completed",
        )
        mc.check_number = stage_card.card_number
        db.flush()

    materials = []
    stock_status = "Available"
    if mc:
        from app.services.workflow_team_service import refresh_pending_material_check_stock

        refresh_pending_material_check_stock(db, tenant_id, mc)
        for ln in mc.lines or []:
            req = float(ln.required_qty or 0)
            avail = float(ln.available_qty or 0)
            reserved = float(getattr(ln, "_reserved_qty", 0) or 0)
            short = float(ln.shortage_qty or 0)
            avail_st = _availability_status(req, max(0.0, avail - reserved))
            if avail_st != "Available":
                stock_status = avail_st if stock_status == "Available" else stock_status
            code = ""
            if ln.product_id:
                prod = db.get(Product, ln.product_id)
                code = prod.sku if prod else ""
            materials.append({
                "id": ln.id,
                "material_code": code,
                "material_name": ln.material_name,
                "required_qty": req,
                "available_qty": avail,
                "reserved_qty": reserved,
                "shortage_qty": short,
                "unit": "Nos",
                "stock_location": ln.stock_location,
                "availability_status": avail_st,
            })
        if any(m["availability_status"] == "Not Available" for m in materials):
            stock_status = "Not Available"
        elif any(m["availability_status"] == "Partial" for m in materials):
            stock_status = "Partial"

    return {
        "card_number": stage_card.card_number if stage_card else (mc.check_number if mc else None),
        "card_status": stage_card.status if stage_card else (mc.status if mc else "pending"),
        "material_check_id": mc.id if mc else None,
        "stock_status": stock_status,
        "materials": materials,
        "notes": mc.notes if mc else None,
    }


def _build_store_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
) -> dict[str, Any]:
    mc = db.scalars(
        select(SalesOrderMaterialCheck)
        .options(selectinload(SalesOrderMaterialCheck.lines))
        .where(
            SalesOrderMaterialCheck.sales_order_id == sales_order_id,
            SalesOrderMaterialCheck.tenant_id == tenant_id,
        )
    ).first()
    if mc and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "store",
            material_check_id=mc.id,
            status="pending",
        )
    if stage_card and mc:
        _ensure_store_issue_lines(db, stage_card, mc)

    issue_lines = []
    if stage_card:
        for ln in stage_card.issue_lines or []:
            issue_lines.append({
                "id": ln.id,
                "material_code": ln.material_code,
                "material_name": ln.material_name,
                "required_qty": float(ln.required_qty),
                "available_qty": float(ln.available_qty),
                "issued_qty": float(ln.issued_qty),
                "remaining_qty": float(ln.remaining_qty),
                "store_location": ln.store_location,
                "issue_status": ln.issue_status,
            })

    return {
        "card_number": stage_card.card_number if stage_card else None,
        "card_status": stage_card.status if stage_card else "pending",
        "material_issue_lines": issue_lines,
        "stock_verification": mc.status if mc else None,
    }


def _build_production_manager_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
) -> dict[str, Any]:
    wo = _primary_work_order(db, tenant_id, sales_order_id)
    if wo and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "production_manager",
            work_order_id=wo.id,
            status="pending",
        )
    assigned_name = None
    plan = {}
    if wo:
        if wo.assigned_user_id:
            u = db.get(User, wo.assigned_user_id)
            assigned_name = u.full_name if u else None
        plan = {
            "work_order_id": wo.id,
            "work_order_number": wo.work_order_number,
            "machine_id": wo.machine_id,
            "planned_quantity": float(wo.planned_quantity or 0),
            "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
            "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
            "assigned_operator": assigned_name,
            "assigned_operator_id": wo.assigned_user_id,
            "status": wo.status,
        }
    store_card = get_stage_card(db, tenant_id, sales_order_id, "store")
    materials_issued = store_card.status == "completed" if store_card else False

    return {
        "card_number": stage_card.card_number if stage_card else None,
        "card_status": stage_card.status if stage_card else "pending",
        "materials_issued": materials_issued,
        "production_plan": plan,
        "production_instructions": wo.notes if wo else None,
    }


OPERATOR_TIMELINE_ACTIONS = {
    "JOB_CARD_CREATED": "Job Card Created",
    "PRODUCTION_JOB_ASSIGNED": "Assigned to Operator",
    "PRODUCTION_STARTED": "Production Started",
    "PRODUCTION_PAUSED": "Production Paused",
    "PRODUCTION_RESUMED": "Production Resumed",
    "PRODUCTION_COMPLETED": "Production Completed",
    "QUALITY_CHECK_CREATED": "Sent to Quality",
}


def _load_stage_payload(stage_card: WorkflowStageJobCard | None) -> dict[str, Any]:
    if not stage_card or not stage_card.payload_json:
        return {}
    try:
        return json.loads(stage_card.payload_json)
    except json.JSONDecodeError:
        return {}


def _operator_materials(db: Session, tenant_id: int, sales_order_id: int, default_unit: str = "Nos") -> list[dict[str, Any]]:
    mc = db.scalars(
        select(SalesOrderMaterialCheck)
        .options(selectinload(SalesOrderMaterialCheck.lines))
        .where(
            SalesOrderMaterialCheck.sales_order_id == sales_order_id,
            SalesOrderMaterialCheck.tenant_id == tenant_id,
        )
    ).first()
    materials: list[dict[str, Any]] = []
    if not mc:
        return materials
    for ln in mc.lines or []:
        req = float(ln.required_qty or 0)
        avail = float(ln.available_qty or 0)
        code = ""
        if ln.product_id:
            prod = db.get(Product, ln.product_id)
            code = prod.sku if prod else ""
        materials.append(
            {
                "id": ln.id,
                "material_code": code,
                "material_name": ln.material_name,
                "required_qty": req,
                "available_qty": avail,
                "unit": default_unit,
                "availability_status": _availability_status(req, avail),
            }
        )
    return materials


def _build_operator_timeline(db: Session, tenant_id: int, sales_order_id: int) -> list[dict[str, Any]]:
    from app.models.manufacturing_workflow import ManufacturingWorkflowTransition

    transitions = list(
        db.scalars(
            select(ManufacturingWorkflowTransition)
            .where(
                ManufacturingWorkflowTransition.tenant_id == tenant_id,
                ManufacturingWorkflowTransition.sales_order_id == sales_order_id,
                ManufacturingWorkflowTransition.action.in_(tuple(OPERATOR_TIMELINE_ACTIONS.keys())),
            )
            .order_by(ManufacturingWorkflowTransition.id.asc())
        ).all()
    )
    events: list[dict[str, Any]] = []
    for tr in transitions:
        role = (tr.team or tr.user_role or "Team").replace("_", " ").title()
        actor = tr.user_name or role
        events.append(
            {
                "key": f"{tr.action}_{tr.id}",
                "title": OPERATOR_TIMELINE_ACTIONS.get(tr.action, tr.action.replace("_", " ").title()),
                "timestamp": tr.created_at.isoformat() if tr.created_at else None,
                "display_time": _fmt_dt(tr.created_at),
                "status": "completed",
                "actor": f"by {actor}",
                "role": role,
            }
        )
    return events


def _operator_allowed_actions(
    ws: str,
    wo_status: str | None,
    stage_status: str | None,
    editable: bool,
) -> list[str]:
    if not editable:
        return ["view"]
    if ws == "PRODUCTION_ASSIGNED":
        return ["start_work"]
    if ws == "PRODUCTION_IN_PROGRESS":
        paused = wo_status == "paused" or stage_status == "on_hold"
        if paused:
            return ["resume", "complete_production"]
        return ["pause", "complete_production"]
    return ["view"]


def _operator_status_label(ws: str, wo_status: str | None, stage_status: str | None) -> str:
    if ws == "QUALITY_CHECK_PENDING":
        return "Quality Check"
    if ws == "PRODUCTION_COMPLETED":
        return "Completed"
    if ws == "PRODUCTION_ASSIGNED":
        return "Assigned"
    if wo_status == "paused" or stage_status == "on_hold":
        return "Paused"
    if ws == "PRODUCTION_IN_PROGRESS":
        return "In Progress"
    return ws.replace("_", " ").title()


def _build_operator_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
    user: User | None,
) -> dict[str, Any]:
    from app.models.machine import Machine

    wo = _primary_work_order(db, tenant_id, sales_order_id)
    if wo and user and wo.assigned_user_id == user.id and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "operator",
            work_order_id=wo.id,
            assigned_user_id=user.id,
            status="assigned",
        )
    pm_card = get_stage_card(db, tenant_id, sales_order_id, "production_manager")
    pm_payload = _load_stage_payload(pm_card)
    op_payload = _load_stage_payload(stage_card)

    production_manager_name = None
    if pm_card and pm_card.completed_by_user_id:
        u = db.get(User, pm_card.completed_by_user_id)
        production_manager_name = u.full_name if u else None
    elif wo and wo.supervisor:
        production_manager_name = wo.supervisor

    operator_name = None
    if stage_card and stage_card.assigned_user_id:
        u = db.get(User, stage_card.assigned_user_id)
        operator_name = u.full_name if u else None
    elif wo and wo.assigned_user_id:
        u = db.get(User, wo.assigned_user_id)
        operator_name = u.full_name if u else wo.operator_name

    machine_name = None
    machine_code = None
    if wo and wo.machine_id:
        machine = db.get(Machine, wo.machine_id)
        if machine:
            machine_name = machine.name
            machine_code = machine.code

    target_qty = float(wo.planned_quantity or ctx["quantity"]) if wo else float(ctx["quantity"])
    produced_qty = float(wo.actual_quantity or op_payload.get("produced_qty") or 0) if wo else 0
    rejected_qty = float(op_payload.get("rejected_qty") or 0)
    rework_qty = float(op_payload.get("rework_qty") or 0)

    execution: dict[str, Any] = {}
    if wo:
        execution = {
            "work_order_id": wo.id,
            "task": wo.work_order_number,
            "planned_qty": target_qty,
            "target_qty": target_qty,
            "completed_qty": produced_qty,
            "produced_qty": produced_qty,
            "rejected_qty": rejected_qty,
            "rework_qty": rework_qty,
            "start_time": op_payload.get("actual_start_time") or _fmt_dt(wo.planned_start),
            "end_time": op_payload.get("actual_end_time"),
            "actual_start_time": op_payload.get("actual_start_time"),
            "actual_end_time": op_payload.get("actual_end_time"),
            "machine_id": wo.machine_id,
            "machine_name": machine_name,
            "machine_code": machine_code,
            "status": wo.status,
            "operator_remarks": op_payload.get("operator_remarks") or op_payload.get("notes"),
        }

    ws = ctx["workflow_status"]
    stage_status = stage_card.status if stage_card else "pending"
    wo_status = wo.status if wo else None
    editable = _stage_editable("operator", ws, user)

    instructions = {
        "operation": pm_payload.get("operation") or pm_payload.get("production_process") or (wo.work_order_number if wo else None),
        "machine": machine_name or machine_code or (str(wo.machine_id) if wo and wo.machine_id else None),
        "work_instructions": pm_payload.get("work_instructions") or pm_payload.get("production_instructions"),
        "target_quantity": target_qty,
        "standard_production_time": pm_payload.get("standard_production_time"),
        "safety_instructions": pm_payload.get("safety_instructions"),
        "special_instructions": pm_payload.get("special_instructions"),
    }

    due_dt = ctx.get("delivery_date")
    if wo and wo.planned_end:
        due_dt = wo.planned_end.isoformat()

    return {
        "card_number": stage_card.card_number if stage_card else None,
        "card_status": stage_status,
        "status_label": _operator_status_label(ws, wo_status, stage_status),
        "production_process": instructions.get("operation"),
        "machine": machine_name or machine_code,
        "work_instructions": instructions.get("work_instructions"),
        "assigned_by": production_manager_name,
        "assigned_date": _fmt_dt(stage_card.created_at if stage_card else None),
        "execution": execution,
        "materials": _operator_materials(db, tenant_id, sales_order_id, ctx.get("unit") or "Nos"),
        "production_instructions": instructions,
        "product_info": {
            "product_name": ctx["product_name"],
            "product_code": ctx["product_code"],
            "customer": ctx["customer_name"],
            "required_quantity": float(ctx["quantity"]),
            "target_quantity": target_qty,
            "unit": ctx["unit"],
            "delivery_date": ctx["delivery_date"],
        },
        "header_panel": {
            "job_card_no": stage_card.card_number if stage_card else "—",
            "sales_order_no": ctx["sales_order"].order_number,
            "sales_job_card_no": ctx["sales_job_card_no"],
            "priority": ctx["priority"],
            "status": _operator_status_label(ws, wo_status, stage_status),
            "assigned_operator": operator_name,
            "production_manager": production_manager_name,
            "due_date": due_dt,
        },
        "timeline": _build_operator_timeline(db, tenant_id, sales_order_id),
        "allowed_actions": _operator_allowed_actions(ws, wo_status, stage_status, editable),
        "editable": editable and ws in {"PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"},
    }


def _build_quality_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
) -> dict[str, Any]:
    so = ctx["sales_order"]
    qi = db.scalars(
        select(QualityInspection).where(
            QualityInspection.tenant_id == tenant_id,
            QualityInspection.sales_order_number == so.order_number,
            QualityInspection.inspection_type == "final",
        ).order_by(QualityInspection.id.desc())
    ).first()
    if qi and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "quality",
            quality_inspection_id=qi.id,
            status="in_progress",
        )
    wo = _primary_work_order(db, tenant_id, sales_order_id)
    operator_name = qi.operator_name if qi else (wo and wo.assigned_user_id and db.get(User, wo.assigned_user_id))

    return {
        "card_number": stage_card.card_number if stage_card else None,
        "card_status": stage_card.status if stage_card else "pending",
        "inspection_id": qi.id if qi else None,
        "produced_quantity": float(qi.quantity or 0) if qi else float(ctx["quantity"]),
        "required_quantity": ctx["quantity"],
        "operator": qi.operator_name if qi else None,
        "production_completion_date": _fmt_dt(getattr(wo, "actual_end", None) if wo else None),
        "inspection_parameters": [
            {"parameter": "Visual", "specification": "No defects", "actual_value": qi.result if qi else "", "result": qi.result if qi else "pending", "remarks": qi.notes if qi else ""},
        ] if qi else [],
        "quality_result": qi.result if qi else "pending",
    }


def _build_packing_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
) -> dict[str, Any]:
    dispatch = db.scalars(
        select(DispatchShipment).where(
            DispatchShipment.sales_order_id == sales_order_id,
            DispatchShipment.tenant_id == tenant_id,
        ).order_by(DispatchShipment.id.desc())
    ).first()
    if dispatch and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "packing",
            dispatch_id=dispatch.id,
            status="in_progress",
        )
    payload = {}
    if stage_card and stage_card.payload_json:
        try:
            payload = json.loads(stage_card.payload_json)
        except json.JSONDecodeError:
            payload = {}

    return {
        "card_number": stage_card.card_number if stage_card else None,
        "card_status": stage_card.status if stage_card else "pending",
        "approved_quantity": ctx["quantity"],
        "quality_status": "PASS",
        "packing": payload.get("packing", {}),
        "dispatch": {
            "dispatch_id": dispatch.id if dispatch else None,
            "dispatch_date": dispatch.dispatch_date.isoformat() if dispatch and dispatch.dispatch_date else None,
            "transporter": dispatch.courier if dispatch else None,
            "vehicle_no": dispatch.vehicle_number if dispatch else None,
            "lr_number": dispatch.lr_number if dispatch else None,
            **payload.get("dispatch", {}),
        },
    }


def _build_billing_card(
    db: Session,
    tenant_id: int,
    sales_order_id: int,
    stage_card: WorkflowStageJobCard | None,
    ctx: dict,
) -> dict[str, Any]:
    invoice = db.scalars(
        select(Invoice).where(
            Invoice.sales_order_id == sales_order_id,
            Invoice.tenant_id == tenant_id,
        ).order_by(Invoice.id.desc())
    ).first()
    dispatch = db.scalars(
        select(DispatchShipment).where(
            DispatchShipment.sales_order_id == sales_order_id,
            DispatchShipment.tenant_id == tenant_id,
        ).order_by(DispatchShipment.id.desc())
    ).first()
    if invoice and not stage_card:
        stage_card = ensure_stage_card(
            db, tenant_id, sales_order_id, "billing",
            invoice_id=invoice.id,
            status="completed" if ctx["workflow_status"] == "COMPLETED" else "in_progress",
        )

    return {
        "card_number": stage_card.card_number if stage_card else None,
        "card_status": stage_card.status if stage_card else "pending",
        "dispatched_quantity": ctx["quantity"],
        "dispatch_reference": dispatch.dispatch_number if dispatch else None,
        "billing": {
            "invoice_id": invoice.id if invoice else None,
            "invoice_no": invoice.invoice_number if invoice else None,
            "invoice_date": invoice.issue_date.isoformat() if invoice and invoice.issue_date else None,
            "taxable_amount": float(invoice.subtotal or 0) if invoice else None,
            "tax": float(invoice.tax_total or 0) if invoice and hasattr(invoice, "tax_total") else None,
            "total_amount": float(invoice.grand_total or 0) if invoice else None,
        },
    }


def _primary_work_order(db: Session, tenant_id: int, sales_order_id: int) -> WorkOrder | None:
    po = db.scalars(
        select(ProductionOrder).where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.sales_order_id == sales_order_id,
        )
    ).first()
    if not po:
        return None
    return db.scalars(
        select(WorkOrder).where(WorkOrder.production_order_id == po.id)
    ).first()


def list_live_workflow_cards(
    db: Session, tenant_id: int, *, limit: int = 10, status_filter: str | None = None
) -> list[dict[str, Any]]:
    """Active workflow cards for admin dashboard live section."""
    q = select(SalesOrder).where(
        SalesOrder.tenant_id == tenant_id,
        SalesOrder.workflow_status.isnot(None),
        SalesOrder.workflow_status != "COMPLETED",
    )
    if status_filter:
        q = q.where(SalesOrder.workflow_status == status_filter.upper())
    orders = list(db.scalars(q.order_by(SalesOrder.id.desc()).limit(limit)).all())
    items = []
    for so in orders:
        ctx = _order_context(db, tenant_id, so.id)
        sjc = _get_sales_job_card(db, tenant_id, so.id)
        items.append({
            "sales_order_id": so.id,
            "job_card_no": sjc.job_card_no if sjc else f"SO-{so.order_number}",
            "customer": ctx["customer_name"],
            "product": ctx["product_name"],
            "quantity": ctx["quantity"],
            "unit": ctx["unit"],
            "priority": ctx["priority"],
            "workflow_status": so.workflow_status,
            "workflow_tracker": build_workflow_tracker(so.workflow_status),
        })
    return items


def complete_stage_card(
    db: Session,
    card: WorkflowStageJobCard,
    user: User,
    *,
    status: str = "completed",
) -> None:
    card.status = status
    card.completed_by_user_id = user.id
    card.completed_at = datetime.now(timezone.utc)
