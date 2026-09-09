"""Manual Sales Job Card — fully user-entered document, no SO/customer/product auto-fill."""

from __future__ import annotations

import logging
import re
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.manufacturing_workflow import SalesJobCard
from app.models.user import User
from app.services.job_card_details import merge_details, parse_details_json, serialize_details_json
from app.services.job_card_service import _generate_job_card_no

logger = logging.getLogger(__name__)

MANUAL_WORKFLOW_DRAFT = "DRAFT"
MANUAL_WORKFLOW_RETURNED = "RETURNED_TO_SALES"

STORE_INVENTORY_STATUSES = frozenset({
    "MATERIAL_CHECK_PENDING",
    "MATERIAL_SHORTAGE",
    "MATERIAL_PARTIAL",
    "MATERIAL_AVAILABLE",
    "STORE_ISSUE_PENDING",
    "STORE_ISSUE_PARTIAL",
})


def empty_manual_document() -> dict[str, Any]:
    return {
        "header": {
            "job_card_date": date.today().isoformat(),
            "sales_order_no": "",
            "customer_po_no": "",
        },
        "customer": {
            "customer_name": "",
            "contact_person": "",
            "phone": "",
            "email": "",
            "billing_address": "",
        },
        "order": {
            "sales_order_date": "",
            "delivery_date": "",
            "product_category": "",
            "end_use": "",
            "payment_terms": "",
            "priority": "medium",
            "remarks": "",
        },
        "product_lines": [],
        "technical_specifications": [],
        "approval": {
            "prepared_by": "",
            "prepared_date": "",
            "checked_by": "",
            "checked_date": "",
            "approved_by": "",
            "approved_date": "",
            "customer_acknowledgement": "",
        },
    }


def _trim(value: Any, max_len: int = 500) -> str:
    if value is None:
        return ""
    return str(value).strip()[:max_len]


def _parse_date(value: Any) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()[:32]
    if not text:
        return None
    try:
        return date.fromisoformat(text[:10])
    except ValueError:
        return None


def _normalize_product_line(row: Any, index: int) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {}
    qty = row.get("quantity")
    try:
        qty_val = float(qty) if qty not in (None, "") else None
    except (TypeError, ValueError):
        qty_val = None
    return {
        "sl_no": index + 1,
        "product_code": _trim(row.get("product_code"), 64),
        "product_name": _trim(row.get("product_name"), 255),
        "description": _trim(row.get("description"), 500),
        "quantity": qty_val,
        "uom": _trim(row.get("uom") or row.get("unit"), 32) or "Nos",
    }


def _normalize_spec_row(row: Any, index: int) -> dict[str, Any]:
    if not isinstance(row, dict):
        return {}
    return {
        "sl_no": index + 1,
        "parameter": _trim(row.get("parameter"), 255),
        "specification": _trim(row.get("specification"), 500),
    }


def merge_manual_document(existing: dict[str, Any], patch: dict[str, Any]) -> dict[str, Any]:
    base = empty_manual_document()
    if not isinstance(existing, dict):
        existing = {}
    if not isinstance(patch, dict):
        patch = {}
    src = {**base, **existing}
    for section in ("header", "customer", "order", "approval"):
        if isinstance(patch.get(section), dict):
            src[section] = {**src.get(section, {}), **patch[section]}
    if isinstance(patch.get("product_lines"), list):
        src["product_lines"] = [_normalize_product_line(r, i) for i, r in enumerate(patch["product_lines"])]
    elif isinstance(existing.get("product_lines"), list):
        src["product_lines"] = [_normalize_product_line(r, i) for i, r in enumerate(existing["product_lines"])]
    if isinstance(patch.get("technical_specifications"), list):
        src["technical_specifications"] = [
            _normalize_spec_row(r, i) for i, r in enumerate(patch["technical_specifications"])
        ]
    elif isinstance(existing.get("technical_specifications"), list):
        src["technical_specifications"] = [
            _normalize_spec_row(r, i) for i, r in enumerate(existing["technical_specifications"])
        ]
    return src


def extract_manual_document(details: dict[str, Any]) -> dict[str, Any]:
    doc = details.get("manual_document")
    if isinstance(doc, dict) and doc:
        return merge_manual_document({}, doc)
    return empty_manual_document()


def _empty_store_workflow() -> dict[str, Any]:
    return {
        "routed_at": None,
        "routed_by": None,
        "routed_by_user_id": None,
        "notification_sent": False,
        "acknowledged": False,
        "acknowledged_by": None,
        "acknowledged_by_user_id": None,
        "acknowledged_at": None,
        "store_comments": [],
        "returned_to_sales": False,
        "returned_at": None,
        "returned_by": None,
        "returned_by_user_id": None,
        "return_remarks": None,
    }


def get_store_workflow(details: dict[str, Any]) -> dict[str, Any]:
    sw = details.get("store_workflow")
    if isinstance(sw, dict):
        return {**_empty_store_workflow(), **sw}
    return _empty_store_workflow()


def manual_queue_status_label(jc: SalesJobCard, store_wf: dict[str, Any] | None = None) -> str:
    from app.services.workflow_routing_service import STORE_QUEUE_STATUS_LABELS

    sw = store_wf or {}
    ws = (jc.workflow_stage or "").upper()
    if ws == MANUAL_WORKFLOW_RETURNED:
        return "Returned to Sales"
    if ws == MANUAL_WORKFLOW_DRAFT or jc.status == "draft":
        return "Draft"
    if ws == "MATERIAL_CHECK_PENDING":
        if sw.get("acknowledged"):
            return "Store Reviewed"
        return "Pending Store Review"
    return STORE_QUEUE_STATUS_LABELS.get(ws, ws.replace("_", " ").title() if ws else "—")


def build_material_requirements_preview(doc: dict[str, Any]) -> list[dict[str, Any]]:
    lines = doc.get("product_lines") or []
    specs = doc.get("technical_specifications") or []
    requirements: list[dict[str, Any]] = []
    for i, row in enumerate(lines):
        requirements.append({
            "line_no": i + 1,
            "product_code": row.get("product_code"),
            "product_name": row.get("product_name"),
            "description": row.get("description"),
            "quantity": row.get("quantity"),
            "uom": row.get("uom"),
            "specifications": specs,
        })
    return requirements


def _users_for_roles(db: Session, tenant_id: int, role_names: list[str]) -> list[int]:
    from app.models.role import Role
    from app.models.user import user_roles

    rows = db.scalars(
        select(User.id)
        .join(user_roles, User.id == user_roles.c.user_id)
        .join(Role, Role.id == user_roles.c.role_id)
        .where(
            User.tenant_id == tenant_id,
            User.is_active.is_(True),
            Role.name.in_(role_names),
        )
        .distinct()
    ).all()
    return list(rows)


def _notify_store_managers_manual(
    db: Session,
    tenant_id: int,
    jc: SalesJobCard,
    doc: dict[str, Any],
    actor: User,
) -> None:
    from app.core.workflow_constants import STATUS_NOTIFY_ROLES, normalize_priority
    from app.services.notification_management_service import NotificationManagementService

    role_names = STATUS_NOTIFY_ROLES.get("MATERIAL_CHECK_PENDING", ["Store Manager", "Admin"])
    user_ids = _users_for_roles(db, tenant_id, role_names)
    if actor:
        user_ids = [uid for uid in user_ids if uid != actor.id]
    if not user_ids:
        return

    customer = (doc.get("customer") or {}).get("customer_name") or "Customer"
    lines = doc.get("product_lines") or []
    first = lines[0] if lines else {}
    product = first.get("product_name") or "Product"
    qty = first.get("quantity") or jc.quantity
    uom = first.get("uom") or jc.unit or "Nos"
    title = "New Sales Job Card Received"
    message = (
        f"Job Card: {jc.job_card_no}\n"
        f"Customer: {customer}\n"
        f"Product: {product}\n"
        f"Quantity: {qty:,} {uom}"
    )
    action_url = f"/my-job-cards?dept=inventory&jc={jc.id}"
    priority = normalize_priority(jc.priority)

    for uid in user_ids:
        try:
            NotificationManagementService.create_for_user(
                db,
                tenant_id=tenant_id,
                user_id=uid,
                title=title,
                message=message,
                type="production",
                priority=priority,
                module="production",
                action_url=action_url,
                created_by=actor.full_name if actor else "System",
                created_by_user_id=actor.id if actor else None,
                commit=False,
            )
        except Exception as exc:
            logger.exception(
                "Manual job card store notification failed user_id=%s jc_id=%s: %s",
                uid,
                jc.id,
                exc,
            )


def _route_manual_to_store(
    db: Session,
    jc: SalesJobCard,
    user: User,
    details: dict[str, Any],
) -> dict[str, Any]:
    """Idempotent handoff to Store Manager queue on submit."""
    store_wf = get_store_workflow(details)
    ws = (jc.workflow_stage or "").upper()

    if store_wf.get("routed_at") and ws in STORE_INVENTORY_STATUSES:
        return details

    if jc.status != "created":
        return details

    doc = extract_manual_document(details)
    jc.workflow_stage = "MATERIAL_CHECK_PENDING"
    now = datetime.now(timezone.utc).isoformat()
    store_wf["routed_at"] = now
    store_wf["routed_by"] = user.full_name or ""
    store_wf["routed_by_user_id"] = user.id
    details["store_workflow"] = store_wf

    if not store_wf.get("notification_sent"):
        _notify_store_managers_manual(db, jc.tenant_id, jc, doc, user)
        store_wf["notification_sent"] = True
        details["store_workflow"] = store_wf

    return details


def _manual_in_store_workflow(jc: SalesJobCard) -> bool:
    ws = (jc.workflow_stage or "").upper()
    return ws in STORE_INVENTORY_STATUSES


def _store_allowed_actions(jc: SalesJobCard, store_wf: dict[str, Any], user: User | None) -> list[str]:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_INVENTORY, TEAM_SALES, user_teams

    if not user:
        return ["view"]
    teams = user_teams(get_role_names(user))
    is_admin = user_is_admin(user)
    ws = (jc.workflow_stage or "").upper()
    actions: list[str] = ["view"]

    if TEAM_INVENTORY in teams or is_admin:
        if ws in STORE_INVENTORY_STATUSES:
            if not store_wf.get("acknowledged"):
                actions.append("acknowledge")
            actions.extend([
                "check_inventory",
                "view_material_requirement",
                "add_store_comments",
                "return_to_sales",
            ])
            if store_wf.get("acknowledged"):
                actions.append("mark_reviewed")

    if (TEAM_SALES in teams or is_admin) and (
        ws == MANUAL_WORKFLOW_RETURNED or jc.status == "draft"
    ):
        actions.extend(["save_job_card", "submit"])

    return list(dict.fromkeys(actions))


def validate_manual_document(doc: dict[str, Any], *, finalize: bool = True) -> dict[str, str]:
    errors: dict[str, str] = {}
    if not finalize:
        return errors

    header = doc.get("header") or {}
    customer = doc.get("customer") or {}
    order = doc.get("order") or {}
    lines = doc.get("product_lines") or []

    if not _trim(header.get("job_card_date")):
        errors["header.job_card_date"] = "Date is required"
    if not _trim(header.get("sales_order_no")):
        errors["header.sales_order_no"] = "Sales Order No. is required"
    if not _trim(customer.get("customer_name")):
        errors["customer.customer_name"] = "Customer Name is required"

    email = _trim(customer.get("email"))
    if email and not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        errors["customer.email"] = "Enter a valid email address"

    phone = _trim(customer.get("phone"))
    if phone and not re.match(r"^[\d\s+\-()]{6,20}$", phone):
        errors["customer.phone"] = "Enter a valid phone number"

    so_date = _parse_date(order.get("sales_order_date"))
    delivery = _parse_date(order.get("delivery_date"))
    if so_date and delivery and delivery < so_date:
        errors["order.delivery_date"] = "Delivery Date must be on or after Sales Order Date"

    if not lines:
        errors["product_lines"] = "At least one product row is required"
    else:
        for i, row in enumerate(lines):
            if not _trim(row.get("product_name")):
                errors[f"product_lines.{i}.product_name"] = "Product Name is required"
            qty = row.get("quantity")
            try:
                n = float(qty)
                if n <= 0:
                    errors[f"product_lines.{i}.quantity"] = "Quantity must be greater than 0"
            except (TypeError, ValueError):
                errors[f"product_lines.{i}.quantity"] = "Quantity must be greater than 0"
            if not _trim(row.get("uom")):
                errors[f"product_lines.{i}.uom"] = "UOM is required"

    return errors


def build_manual_sales_document(jc: SalesJobCard, doc: dict[str, Any]) -> dict[str, Any]:
    header = doc.get("header") or {}
    customer = doc.get("customer") or {}
    order = doc.get("order") or {}
    lines = doc.get("product_lines") or []
    specs = doc.get("technical_specifications") or []
    approval = doc.get("approval") or {}

    jc_date = header.get("job_card_date") or (
        jc.created_at.date().isoformat() if jc.created_at else date.today().isoformat()
    )
    status_label = "Created" if jc.status == "created" else "Draft"

    return {
        "header": {
            "job_card_no": jc.job_card_no,
            "job_card_date": jc_date,
            "sales_order_no": header.get("sales_order_no"),
            "customer_po_no": header.get("customer_po_no"),
            "status": status_label,
            "workflow_status": jc.workflow_stage or "MANUAL",
        },
        "customer_details": {
            "customer_name": customer.get("customer_name"),
            "contact_person": customer.get("contact_person"),
            "phone": customer.get("phone"),
            "email": customer.get("email"),
            "billing_address": customer.get("billing_address"),
        },
        "order_details": {
            "sales_order_date": order.get("sales_order_date"),
            "delivery_date": order.get("delivery_date") or (
                jc.required_delivery_date.isoformat() if jc.required_delivery_date else None
            ),
            "product_category": order.get("product_category"),
            "end_use": order.get("end_use"),
            "payment_terms": order.get("payment_terms"),
            "priority": order.get("priority") or jc.priority,
            "remarks": order.get("remarks") or jc.notes,
            "sales_person": jc.sales_person_name,
        },
        "product_lines": lines,
        "technical_specifications": specs,
        "approval": approval,
    }


def _summary_from_doc(jc: SalesJobCard, doc: dict[str, Any]) -> dict[str, Any]:
    lines = doc.get("product_lines") or []
    first = lines[0] if lines else {}
    total_qty = sum(float(ln.get("quantity") or 0) for ln in lines)
    customer = doc.get("customer") or {}
    header = doc.get("header") or {}
    order = doc.get("order") or {}
    return {
        "job_card_no": jc.job_card_no,
        "sales_order_no": header.get("sales_order_no"),
        "customer": customer.get("customer_name"),
        "product": first.get("product_name"),
        "order_quantity": total_qty or jc.quantity,
        "required_delivery": order.get("delivery_date"),
        "priority": order.get("priority") or jc.priority,
        "uom": first.get("uom") or jc.unit,
        "workflow_status": jc.workflow_stage or "MANUAL",
    }


def build_manual_job_card_response(db: Session, jc: SalesJobCard, user: User | None = None) -> dict[str, Any]:
    details = parse_details_json(jc.details_json)
    doc = extract_manual_document(details)
    store_wf = get_store_workflow(details)
    sales_document = build_manual_sales_document(jc, doc)
    creator_name = None
    if jc.created_by_user_id:
        creator = db.get(User, jc.created_by_user_id)
        creator_name = creator.full_name if creator else None

    lines = doc.get("product_lines") or []
    first = lines[0] if lines else {}
    ws = jc.workflow_stage or MANUAL_WORKFLOW_DRAFT
    in_store = _manual_in_store_workflow(jc)
    queue_label = manual_queue_status_label(jc, store_wf)
    allowed = _store_allowed_actions(jc, store_wf, user)
    editable = ["sales"]
    if in_store:
        editable = []

    return {
        "id": jc.id,
        "job_card_id": jc.id,
        "is_manual": True,
        "sales_order_id": None,
        "job_card_no": jc.job_card_no,
        "job_card_created": jc.status == "created",
        "status": jc.status,
        "workflow_status": ws,
        "workflow_stage": queue_label,
        "queue_status_label": queue_label,
        "priority": jc.priority,
        "sales_document": sales_document,
        "manual_document": doc,
        "details": details,
        "store_workflow": store_wf,
        "material_requirements": build_material_requirements_preview(doc),
        "summary_panel": _summary_from_doc(jc, doc),
        "form": {
            "job_card_id": jc.id,
            "job_card_no": jc.job_card_no,
            "is_manual": True,
            "is_created": jc.status == "created",
            "notes": jc.notes or "",
            "priority": jc.priority,
            "quantity": float(jc.quantity or 0),
            "unit": jc.unit,
            "required_delivery_date": (
                jc.required_delivery_date.isoformat() if jc.required_delivery_date else None
            ),
        },
        "audit": {
            "created_by": creator_name,
            "created_by_id": jc.created_by_user_id,
            "created_at": jc.created_at.isoformat() if jc.created_at else None,
            "updated_at": jc.updated_at.isoformat() if jc.updated_at else None,
            "reviewed_by": store_wf.get("acknowledged_by"),
            "reviewed_at": store_wf.get("acknowledged_at"),
        },
        "editable_sections": editable,
        "read_only_sales": in_store,
        "allowed_actions": allowed,
        "responsible_role": "Store Manager" if in_store else "Sales",
        "header": {
            "product": first.get("product_name"),
            "order_qty": float(jc.quantity or 0),
            "uom": jc.unit,
        },
    }


def _get_manual_job_card(db: Session, tenant_id: int, job_card_id: int) -> SalesJobCard:
    jc = db.scalars(
        select(SalesJobCard).where(
            SalesJobCard.id == job_card_id,
            SalesJobCard.tenant_id == tenant_id,
            SalesJobCard.sales_order_id.is_(None),
        )
    ).first()
    if not jc:
        raise HTTPException(status_code=404, detail="Job card not found")
    return jc


def _apply_manual_to_record(jc: SalesJobCard, doc: dict[str, Any]) -> None:
    lines = doc.get("product_lines") or []
    first = lines[0] if lines else {}
    order = doc.get("order") or {}
    total_qty = sum(float(ln.get("quantity") or 0) for ln in lines) or float(first.get("quantity") or 0)
    jc.quantity = total_qty
    jc.unit = _trim(first.get("uom")) or "Nos"
    jc.priority = _trim(order.get("priority")) or jc.priority or "medium"
    jc.notes = _trim(order.get("remarks"), 500) or None
    jc.required_delivery_date = _parse_date(order.get("delivery_date"))
    jc.customer_id = None
    jc.product_id = None


def create_manual_job_card(
    db: Session,
    tenant_id: int,
    user: User,
    payload: dict[str, Any],
    *,
    finalize: bool = True,
) -> dict[str, Any]:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_SALES, user_teams

    teams = user_teams(get_role_names(user))
    if not user_is_admin(user) and TEAM_SALES not in teams:
        raise HTTPException(status_code=403, detail="Sales team permission required")

    manual_patch = payload.get("manual_document") or payload
    doc = merge_manual_document({}, manual_patch)
    errors = validate_manual_document(doc, finalize=finalize)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Validation failed", "errors": errors})

    approval = doc.get("approval") or {}
    if finalize and not _trim(approval.get("prepared_by")):
        approval["prepared_by"] = user.full_name or ""
        approval["prepared_date"] = date.today().isoformat()
        doc["approval"] = approval

    details = parse_details_json(None)
    details["manual_document"] = doc

    jc = SalesJobCard(
        tenant_id=tenant_id,
        job_card_no=_generate_job_card_no(db, tenant_id),
        sales_order_id=None,
        customer_id=None,
        product_id=None,
        quantity=0,
        unit="Nos",
        priority="medium",
        status="created" if finalize else "draft",
        workflow_stage=MANUAL_WORKFLOW_DRAFT if not finalize else None,
        created_by_user_id=user.id,
        details_json=serialize_details_json(details),
    )
    _apply_manual_to_record(jc, doc)
    if finalize:
        details = _route_manual_to_store(db, jc, user, details)
        jc.details_json = serialize_details_json(details)
    db.add(jc)
    db.commit()
    db.refresh(jc)
    return build_manual_job_card_response(db, jc, user=user)


def update_manual_job_card(
    db: Session,
    tenant_id: int,
    job_card_id: int,
    user: User,
    payload: dict[str, Any],
    *,
    finalize: bool = False,
) -> dict[str, Any]:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_SALES, user_teams

    teams = user_teams(get_role_names(user))
    if not user_is_admin(user) and TEAM_SALES not in teams:
        raise HTTPException(status_code=403, detail="Sales team permission required")

    jc = _get_manual_job_card(db, tenant_id, job_card_id)
    details = parse_details_json(jc.details_json)
    store_wf = get_store_workflow(details)
    ws = (jc.workflow_stage or "").upper()

    if _manual_in_store_workflow(jc) and ws != MANUAL_WORKFLOW_RETURNED:
        raise HTTPException(
            status_code=403,
            detail="Sales information is read-only while the job card is with Store Manager. "
            "Request a correction via Return to Sales.",
        )

    existing_doc = extract_manual_document(details)
    manual_patch = payload.get("manual_document") or payload
    doc = merge_manual_document(existing_doc, manual_patch)
    errors = validate_manual_document(doc, finalize=finalize or jc.status == "created")
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Validation failed", "errors": errors})

    details["manual_document"] = doc
    _apply_manual_to_record(jc, doc)
    if finalize and jc.status != "created":
        jc.status = "created"
    if finalize:
        details = _route_manual_to_store(db, jc, user, details)
        if store_wf.get("returned_to_sales"):
            store_wf = get_store_workflow(details)
            store_wf["returned_to_sales"] = False
            store_wf["return_remarks"] = None
            details["store_workflow"] = store_wf
    jc.details_json = serialize_details_json(details)
    db.commit()
    db.refresh(jc)
    return build_manual_job_card_response(db, jc, user=user)


def get_manual_job_card(db: Session, tenant_id: int, job_card_id: int, user: User | None = None) -> dict[str, Any]:
    jc = _get_manual_job_card(db, tenant_id, job_card_id)
    return build_manual_job_card_response(db, jc, user=user)


def delete_manual_job_card(db: Session, tenant_id: int, job_card_id: int, user: User) -> None:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_SALES, user_teams

    teams = user_teams(get_role_names(user))
    if not user_is_admin(user) and TEAM_SALES not in teams:
        raise HTTPException(status_code=403, detail="Sales team permission required")

    jc = _get_manual_job_card(db, tenant_id, job_card_id)
    db.delete(jc)
    db.commit()


def serialize_manual_queue_item(
    db: Session,
    jc: SalesJobCard,
    *,
    user: User | None = None,
) -> dict[str, Any]:
    details = parse_details_json(jc.details_json)
    doc = extract_manual_document(details)
    store_wf = get_store_workflow(details)
    sales_doc = build_manual_sales_document(jc, doc)
    header = doc.get("header") or {}
    customer = doc.get("customer") or {}
    order = doc.get("order") or {}
    lines = doc.get("product_lines") or []
    first = lines[0] if lines else {}
    total_qty = sum(float(ln.get("quantity") or 0) for ln in lines)
    creator_name = None
    if jc.created_by_user_id:
        creator = db.get(User, jc.created_by_user_id)
        creator_name = creator.full_name if creator else None

    queue_label = manual_queue_status_label(jc, store_wf)
    in_store = _manual_in_store_workflow(jc)
    ws = jc.workflow_stage or MANUAL_WORKFLOW_DRAFT
    needed_action = None
    if in_store and not store_wf.get("acknowledged"):
        needed_action = "Acknowledge"
    elif in_store and ws == "MATERIAL_CHECK_PENDING":
        needed_action = "Check Stock"

    return {
        "job_card_id": jc.id,
        "sales_order_id": None,
        "is_manual": True,
        "job_card_no": jc.job_card_no,
        "job_card_date": header.get("job_card_date") or (
            jc.created_at.date().isoformat() if jc.created_at else None
        ),
        "order_number": header.get("sales_order_no"),
        "customer_po_no": header.get("customer_po_no"),
        "customer_name": customer.get("customer_name"),
        "product_name": first.get("product_name"),
        "product_code": first.get("product_code"),
        "quantity": total_qty or jc.quantity,
        "unit": first.get("uom") or jc.unit,
        "priority": order.get("priority") or jc.priority,
        "workflow_status": ws,
        "status_label": queue_label,
        "queue_status_label": queue_label,
        "status": queue_label,
        "delivery_date": order.get("delivery_date") or (
            jc.required_delivery_date.isoformat() if jc.required_delivery_date else None
        ),
        "order_date": order.get("sales_order_date"),
        "created_by": creator_name,
        "created_at": jc.created_at.isoformat() if jc.created_at else None,
        "received_at": store_wf.get("routed_at") or (
            jc.created_at.isoformat() if jc.created_at else None
        ),
        "sales_document": sales_doc,
        "manual_document": doc,
        "responsible_role": "Store Manager" if in_store else "Sales",
        "needed_action": needed_action,
        "allowed_actions": _store_allowed_actions(jc, store_wf, user),
        "store_acknowledged": bool(store_wf.get("acknowledged")),
    }


def list_manual_job_cards(
    db: Session,
    tenant_id: int,
    *,
    limit: int = 500,
    for_store: bool = False,
    status_filter: str | None = None,
    user: User | None = None,
) -> list[dict[str, Any]]:
    q = (
        select(SalesJobCard)
        .where(
            SalesJobCard.tenant_id == tenant_id,
            SalesJobCard.sales_order_id.is_(None),
        )
        .order_by(SalesJobCard.id.desc())
        .limit(limit)
    )
    if for_store:
        q = q.where(SalesJobCard.workflow_stage.in_(list(STORE_INVENTORY_STATUSES)))
    cards = list(db.scalars(q).all())
    items = [serialize_manual_queue_item(db, jc, user=user) for jc in cards]
    if status_filter:
        sf = status_filter.upper()
        items = [i for i in items if str(i.get("workflow_status") or "").upper() == sf]
    return items


def count_manual_sales_job_cards_pending(db: Session, tenant_id: int) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(SalesJobCard)
            .where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.sales_order_id.is_(None),
                SalesJobCard.workflow_stage == "MATERIAL_CHECK_PENDING",
            )
        )
        or 0
    )


def acknowledge_manual_job_card(
    db: Session,
    tenant_id: int,
    job_card_id: int,
    user: User,
) -> dict[str, Any]:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_INVENTORY, user_teams

    teams = user_teams(get_role_names(user))
    if not user_is_admin(user) and TEAM_INVENTORY not in teams:
        raise HTTPException(status_code=403, detail="Store Manager permission required")

    jc = _get_manual_job_card(db, tenant_id, job_card_id)
    if not _manual_in_store_workflow(jc):
        raise HTTPException(status_code=400, detail="Job card is not pending store review")

    details = parse_details_json(jc.details_json)
    store_wf = get_store_workflow(details)
    if store_wf.get("acknowledged"):
        return build_manual_job_card_response(db, jc, user=user)

    now = datetime.now(timezone.utc).isoformat()
    store_wf["acknowledged"] = True
    store_wf["acknowledged_by"] = user.full_name or ""
    store_wf["acknowledged_by_user_id"] = user.id
    store_wf["acknowledged_at"] = now
    details["store_workflow"] = store_wf
    jc.details_json = serialize_details_json(details)
    db.commit()
    db.refresh(jc)
    return build_manual_job_card_response(db, jc, user=user)


def return_manual_job_card_to_sales(
    db: Session,
    tenant_id: int,
    job_card_id: int,
    user: User,
    *,
    remarks: str = "",
) -> dict[str, Any]:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_INVENTORY, user_teams
    from app.services.notification_management_service import NotificationManagementService

    teams = user_teams(get_role_names(user))
    if not user_is_admin(user) and TEAM_INVENTORY not in teams:
        raise HTTPException(status_code=403, detail="Store Manager permission required")

    jc = _get_manual_job_card(db, tenant_id, job_card_id)
    if not _manual_in_store_workflow(jc):
        raise HTTPException(status_code=400, detail="Job card cannot be returned from current status")

    details = parse_details_json(jc.details_json)
    store_wf = get_store_workflow(details)
    now = datetime.now(timezone.utc).isoformat()
    store_wf["returned_to_sales"] = True
    store_wf["returned_at"] = now
    store_wf["returned_by"] = user.full_name or ""
    store_wf["returned_by_user_id"] = user.id
    store_wf["return_remarks"] = _trim(remarks, 1000) or None
    details["store_workflow"] = store_wf
    jc.workflow_stage = MANUAL_WORKFLOW_RETURNED
    jc.details_json = serialize_details_json(details)
    db.commit()
    db.refresh(jc)

    if jc.created_by_user_id:
        doc = extract_manual_document(details)
        customer = (doc.get("customer") or {}).get("customer_name") or "Customer"
        try:
            NotificationManagementService.create_for_user(
                db,
                tenant_id=tenant_id,
                user_id=jc.created_by_user_id,
                title="Sales Job Card Returned for Correction",
                message=(
                    f"Job Card {jc.job_card_no} was returned by Store Manager.\n"
                    f"Customer: {customer}\n"
                    f"Remarks: {store_wf.get('return_remarks') or '—'}"
                ),
                type="production",
                priority="high",
                module="production",
                action_url=f"/my-job-cards?dept=sales&jc={jc.id}",
                created_by=user.full_name or "Store Manager",
                created_by_user_id=user.id,
                commit=True,
            )
        except Exception as exc:
            logger.exception("Return-to-sales notification failed jc_id=%s: %s", jc.id, exc)

    return build_manual_job_card_response(db, jc, user=user)


def add_manual_store_comment(
    db: Session,
    tenant_id: int,
    job_card_id: int,
    user: User,
    *,
    comment: str,
) -> dict[str, Any]:
    from app.core.permissions import get_role_names, user_is_admin
    from app.core.workflow_constants import TEAM_INVENTORY, user_teams

    teams = user_teams(get_role_names(user))
    if not user_is_admin(user) and TEAM_INVENTORY not in teams:
        raise HTTPException(status_code=403, detail="Store Manager permission required")

    text = _trim(comment, 2000)
    if not text:
        raise HTTPException(status_code=422, detail="Comment is required")

    jc = _get_manual_job_card(db, tenant_id, job_card_id)
    details = parse_details_json(jc.details_json)
    store_wf = get_store_workflow(details)
    comments = list(store_wf.get("store_comments") or [])
    comments.append({
        "text": text,
        "by": user.full_name or "",
        "by_user_id": user.id,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    store_wf["store_comments"] = comments
    details["store_workflow"] = store_wf
    jc.details_json = serialize_details_json(details)
    db.commit()
    db.refresh(jc)
    return build_manual_job_card_response(db, jc, user=user)
