"""Godown toolkit reads and writes against live inventory records."""

from __future__ import annotations

import math
from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.company_settings import CompanySettings
from app.models.godown_toolkit import (
    EoqCalculation,
    GatePass,
    GatePassLine,
    GodownLabourEntry,
    ItemPhysicalProfile,
    StorageQuotation,
    StorageQuotationLine,
    TruckLoadPlan,
    TruckLoadPlanLine,
    WarehouseLayout,
)
from app.models.inventory import InventoryItem, StockAdjustment, StockLevel, StockMovement, Warehouse
from app.models.sales import Customer
from app.schemas.inventory_extended import StockAdjustmentCreate
from app.services.godown_toolkit_calc import (
    GATE_PASS_TRANSITIONS,
    LOSS_REASONS,
    QUOTE_TRANSITIONS,
    VALUATION_BLOCK_REASON,
    capacity_utilization,
    compute_eoq,
    convert_quantity,
    money,
    quote_totals,
)
from app.services.inventory_extended_service import create_adjustment

CONSUMPTION_MOVEMENTS = ("out", "scrap")
LABOUR_BASIS = ("bag", "tonne", "truck", "kg", "hour")


def _num(value) -> float | None:
    if value is None:
        return None
    return float(value)


def _clean_key(value: str | None) -> str | None:
    text = (value or "").strip()
    return text or None


def _page(page: int, page_size: int) -> tuple[int, int]:
    page = max(1, int(page or 1))
    page_size = min(100, max(1, int(page_size or 25)))
    return page, page_size


def _require_warehouse(db: Session, tenant_id: int, warehouse_id: int) -> Warehouse:
    row = db.scalars(
        select(Warehouse).where(Warehouse.id == warehouse_id, Warehouse.tenant_id == tenant_id)
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Godown was not found for this company.")
    return row


def _require_item(db: Session, tenant_id: int, item_id: int) -> InventoryItem:
    row = db.scalars(
        select(InventoryItem).where(
            InventoryItem.id == item_id,
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.is_active.is_(True),
        )
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Item was not found for this company.")
    return row


def _require_customer(db: Session, tenant_id: int, customer_id: int) -> Customer:
    row = db.scalars(
        select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)
    ).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Customer was not found for this company.")
    return row


def _on_hand(db: Session, tenant_id: int, item_id: int, warehouse_id: int | None = None) -> float:
    stmt = (
        select(func.coalesce(func.sum(StockLevel.quantity), 0))
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(InventoryItem.tenant_id == tenant_id, Warehouse.tenant_id == tenant_id, StockLevel.item_id == item_id)
    )
    if warehouse_id is not None:
        stmt = stmt.where(StockLevel.warehouse_id == warehouse_id)
    return float(db.scalar(stmt) or 0)


def _profile(db: Session, tenant_id: int, item_id: int) -> ItemPhysicalProfile | None:
    return db.scalars(
        select(ItemPhysicalProfile).where(
            ItemPhysicalProfile.tenant_id == tenant_id,
            ItemPhysicalProfile.item_id == item_id,
        )
    ).first()


def _reuse(db: Session, model, tenant_id: int, client_request_id: str | None):
    key = _clean_key(client_request_id)
    if not key:
        return None
    return db.scalars(select(model).where(model.tenant_id == tenant_id, model.client_request_id == key)).first()


def _next_number(db: Session, model, column, tenant_id: int, prefix: str) -> str:
    existing = db.scalars(select(column).where(model.tenant_id == tenant_id)).all()
    highest = 0
    token = f"{prefix}-"
    for value in existing:
        text = str(value or "")
        if text.startswith(token):
            tail = text[len(token):]
            if tail.isdigit():
                highest = max(highest, int(tail))
    return f"{prefix}-{highest + 1:04d}"


def _customer_name(customer: Customer) -> str:
    return customer.company_name or customer.name or customer.contact_name or f"Customer {customer.id}"


def _item_brief(item: InventoryItem, qty: float, profile: ItemPhysicalProfile | None) -> dict:
    return {
        "id": item.id,
        "sku": item.sku,
        "name": item.name,
        "unit": item.unit,
        "category": item.category,
        "quantity": qty,
        "unit_cost": _num(item.unit_cost),
        "reorder_level": item.reorder_level,
        "weight_kg_per_unit": _num(profile.weight_kg_per_unit) if profile else None,
        "volume_cft_per_unit": _num(profile.volume_cft_per_unit) if profile else None,
        "units_per_stack": _num(profile.units_per_stack) if profile else None,
        "stack_area_sqft": _num(profile.stack_area_sqft) if profile else None,
    }


def list_space(db: Session, tenant_id: int) -> dict:
    warehouses = list(
        db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id).order_by(Warehouse.name)).all()
    )
    layouts = {
        row.warehouse_id: row
        for row in db.scalars(select(WarehouseLayout).where(WarehouseLayout.tenant_id == tenant_id)).all()
    }
    rows = []
    for warehouse in warehouses:
        layout = layouts.get(warehouse.id)
        usable = None
        if layout and layout.length_ft and layout.breadth_ft and layout.aisle_pct is not None:
            aisle = float(layout.aisle_pct)
            if 0 <= aisle < 100 and float(layout.length_ft) > 0 and float(layout.breadth_ft) > 0:
                usable = round(float(layout.length_ft) * float(layout.breadth_ft) * (1 - aisle / 100), 2)
        stock_rows = list(
            db.scalars(select(StockLevel).where(StockLevel.warehouse_id == warehouse.id, StockLevel.quantity > 0)).all()
        )
        occupied = 0.0
        missing = []
        for stock in stock_rows:
            profile = _profile(db, tenant_id, stock.item_id)
            item = db.get(InventoryItem, stock.item_id)
            if not profile or profile.units_per_stack is None or profile.stack_area_sqft is None:
                missing.append(item.name if item else f"Item {stock.item_id}")
                continue
            per_stack = float(profile.units_per_stack)
            area = float(profile.stack_area_sqft)
            if per_stack <= 0 or area < 0:
                missing.append(item.name if item else f"Item {stock.item_id}")
                continue
            stacks = math.ceil(float(stock.quantity) / per_stack)
            occupied += stacks * area
        occupied_known = not missing
        if not stock_rows:
            occupied_known = True
            occupied = 0.0
        floor_pct = None
        if occupied_known and usable is not None and usable > 0:
            floor_pct = round(occupied / usable * 100, 1)
        rows.append(
            {
                "id": warehouse.id,
                "name": warehouse.name,
                "code": warehouse.code,
                "status": warehouse.status,
                "capacity": warehouse.capacity,
                "used_capacity": warehouse.used_capacity,
                "capacity_utilization_pct": capacity_utilization(warehouse.capacity, warehouse.used_capacity),
                "length_ft": _num(layout.length_ft) if layout else None,
                "breadth_ft": _num(layout.breadth_ft) if layout else None,
                "clear_height_ft": _num(layout.clear_height_ft) if layout else None,
                "aisle_pct": _num(layout.aisle_pct) if layout else None,
                "usable_sqft": usable,
                "occupied_sqft": round(occupied, 2) if occupied_known else None,
                "floor_utilization_pct": floor_pct,
                "space_status": "available" if occupied_known and usable is not None else "unavailable",
                "space_reason": None
                if occupied_known and usable is not None
                else (
                    "Floor area needs length, breadth, and aisle percent. "
                    "Occupied area also needs units per stack and stack area on every item that has stock."
                    + (f" Missing: {', '.join(missing[:8])}." if missing else "")
                ),
            }
        )
    return {"warehouses": rows}


def save_layout(db: Session, tenant_id: int, warehouse_id: int, payload: dict) -> dict:
    _require_warehouse(db, tenant_id, warehouse_id)
    for key in ("length_ft", "breadth_ft", "clear_height_ft", "aisle_pct"):
        value = payload.get(key)
        if value is None:
            continue
        if float(value) < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Dimensions and aisle percent cannot be negative.")
    aisle = payload.get("aisle_pct")
    if aisle is not None and float(aisle) >= 100:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Aisle percent must be under 100.")
    row = db.scalars(
        select(WarehouseLayout).where(
            WarehouseLayout.tenant_id == tenant_id,
            WarehouseLayout.warehouse_id == warehouse_id,
        )
    ).first()
    if not row:
        row = WarehouseLayout(tenant_id=tenant_id, warehouse_id=warehouse_id)
        db.add(row)
    for key in ("length_ft", "breadth_ft", "clear_height_ft", "aisle_pct"):
        if key in payload:
            setattr(row, key, payload.get(key))
    db.commit()
    return list_space(db, tenant_id)


def list_toolkit_items(db: Session, tenant_id: int, search: str | None, page: int, page_size: int) -> dict:
    page, page_size = _page(page, page_size)
    stmt = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.is_active.is_(True))
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(InventoryItem.name.ilike(term), InventoryItem.sku.ilike(term), InventoryItem.unit.ilike(term)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    items = list(
        db.scalars(stmt.order_by(InventoryItem.name).offset((page - 1) * page_size).limit(page_size)).all()
    )
    rows = []
    for item in items:
        rows.append(_item_brief(item, _on_hand(db, tenant_id, item.id), _profile(db, tenant_id, item.id)))
    return {"items": rows, "total": int(total), "page": page, "page_size": page_size}


def save_item_profile(db: Session, tenant_id: int, item_id: int, payload: dict) -> dict:
    item = _require_item(db, tenant_id, item_id)
    for key in ("weight_kg_per_unit", "volume_cft_per_unit", "units_per_stack", "stack_area_sqft"):
        value = payload.get(key)
        if value is not None and float(value) < 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Weight, volume, and stack values cannot be negative.")
    if payload.get("units_per_stack") is not None and float(payload["units_per_stack"]) <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Units per stack must be greater than zero when it is set.")
    row = _profile(db, tenant_id, item_id)
    if not row:
        row = ItemPhysicalProfile(tenant_id=tenant_id, item_id=item_id)
        db.add(row)
    for key in ("weight_kg_per_unit", "volume_cft_per_unit", "units_per_stack", "stack_area_sqft"):
        if key in payload:
            setattr(row, key, payload.get(key))
    db.commit()
    db.refresh(row)
    return _item_brief(item, _on_hand(db, tenant_id, item.id), row)


def convert_item(db: Session, tenant_id: int, item_id: int, quantity: float, to_unit: str) -> dict:
    if quantity < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Quantity cannot be negative.")
    item = _require_item(db, tenant_id, item_id)
    profile = _profile(db, tenant_id, item_id)
    result = convert_quantity(
        quantity,
        item.unit,
        to_unit,
        weight_kg_per_unit=_num(profile.weight_kg_per_unit) if profile else None,
        volume_cft_per_unit=_num(profile.volume_cft_per_unit) if profile else None,
    )
    if not result["ok"]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, result["reason"])
    stacks = None
    if profile and profile.units_per_stack and float(profile.units_per_stack) > 0:
        stacks = math.ceil(quantity / float(profile.units_per_stack))
    return {
        "item_id": item.id,
        "name": item.name,
        "from_unit": item.unit,
        "to_unit": to_unit,
        "quantity": quantity,
        "converted": result["value"],
        "rule": result["rule"],
        "stacks": stacks,
        "stacks_status": "available" if stacks is not None else "unavailable",
    }


def stock_valuation(db: Session, tenant_id: int, warehouse_id: int | None, search: str | None) -> dict:
    stmt = select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.is_active.is_(True))
    if search and search.strip():
        term = f"%{search.strip()}%"
        stmt = stmt.where(or_(InventoryItem.name.ilike(term), InventoryItem.sku.ilike(term)))
    items = list(db.scalars(stmt.order_by(InventoryItem.name)).all())
    lines = []
    quantity_total = 0.0
    for item in items:
        qty = _on_hand(db, tenant_id, item.id, warehouse_id)
        if warehouse_id is not None and qty == 0:
            continue
        quantity_total += qty
        cost = _num(item.unit_cost)
        lines.append(
            {
                "item_id": item.id,
                "sku": item.sku,
                "name": item.name,
                "unit": item.unit,
                "category": item.category,
                "quantity": qty,
                "unit_cost": cost,
                "cost_status": "recorded_on_item" if cost is not None else "missing",
                "value": None,
            }
        )
    return {
        "status": "blocked",
        "reason": VALUATION_BLOCK_REASON,
        "needed": [
            "Approve a valuation method before any stock value is shown.",
            "Record a unit cost on each stock movement. The movement table currently stores quantity only.",
        ],
        "quantity_total": quantity_total,
        "value_total": None,
        "lines": lines,
    }


def eoq_inputs(db: Session, tenant_id: int, item_id: int) -> dict:
    item = _require_item(db, tenant_id, item_id)
    since = datetime.now(timezone.utc) - timedelta(days=365)
    issued = db.scalar(
        select(func.coalesce(func.sum(StockMovement.quantity), 0)).where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.item_id == item_id,
            StockMovement.movement_type.in_(CONSUMPTION_MOVEMENTS),
            StockMovement.created_at >= since,
        )
    )
    issued_qty = float(issued or 0)
    demand = issued_qty if issued_qty > 0 else None
    return {
        "item_id": item.id,
        "name": item.name,
        "unit": item.unit,
        "annual_demand": demand,
        "demand_source": "stock_issues" if demand is not None else None,
        "demand_note": None
        if demand is not None
        else "No outward or scrap movements were recorded in the last 365 days. Enter annual demand to calculate.",
        "unit_cost": _num(item.unit_cost),
        "unit_cost_source": "item_master" if item.unit_cost is not None else None,
        "order_cost": None,
        "holding_pct": None,
    }


def save_eoq(db: Session, tenant_id: int, payload: dict, created_by: str | None) -> dict:
    existing = _reuse(db, EoqCalculation, tenant_id, payload.get("client_request_id"))
    if existing:
        return _eoq_read(db, existing)
    item = _require_item(db, tenant_id, payload["item_id"])
    inputs = eoq_inputs(db, tenant_id, item.id)
    if payload.get("annual_demand") is not None:
        annual = float(payload["annual_demand"])
        demand_source = "entered"
    elif inputs["annual_demand"] is not None:
        annual = float(inputs["annual_demand"])
        demand_source = "stock_issues"
    else:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, inputs["demand_note"])
    order_cost = payload.get("order_cost")
    if order_cost is None:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Order cost is not stored. Enter it to calculate.")
    order_cost = float(order_cost)
    unit_cost = _num(item.unit_cost)
    unit_source = "item_master" if unit_cost is not None else None
    if payload.get("unit_cost") is not None:
        unit_cost = float(payload["unit_cost"])
        unit_source = "entered"
    holding_cost = payload.get("holding_cost_per_unit")
    holding_pct = payload.get("holding_pct")
    if holding_cost is not None:
        holding_cost = float(holding_cost)
        holding_source_pct = _num(holding_pct)
    elif holding_pct is not None and unit_cost is not None:
        holding_source_pct = float(holding_pct)
        holding_cost = unit_cost * holding_source_pct / 100
    else:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Enter a holding cost per unit, or a holding percent together with a unit cost.",
        )
    try:
        eoq = compute_eoq(annual, order_cost, holding_cost)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    row = EoqCalculation(
        tenant_id=tenant_id,
        item_id=item.id,
        annual_demand=annual,
        demand_source=demand_source,
        order_cost=order_cost,
        order_cost_source="entered",
        holding_pct=holding_source_pct if holding_pct is not None or payload.get("holding_cost_per_unit") is None else holding_pct,
        unit_cost=unit_cost,
        unit_cost_source=unit_source,
        holding_cost_per_unit=holding_cost,
        eoq=round(eoq, 2),
        client_request_id=_clean_key(payload.get("client_request_id")),
        created_by=created_by,
    )
    db.add(row)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This calculation was already saved.") from exc
    db.refresh(row)
    return _eoq_read(db, row)


def _eoq_read(db: Session, row: EoqCalculation) -> dict:
    item = db.get(InventoryItem, row.item_id)
    return {
        "id": row.id,
        "item_id": row.item_id,
        "item_name": item.name if item else None,
        "unit": item.unit if item else None,
        "annual_demand": _num(row.annual_demand),
        "demand_source": row.demand_source,
        "order_cost": _num(row.order_cost),
        "order_cost_source": row.order_cost_source,
        "holding_pct": _num(row.holding_pct),
        "unit_cost": _num(row.unit_cost),
        "unit_cost_source": row.unit_cost_source,
        "holding_cost_per_unit": _num(row.holding_cost_per_unit),
        "eoq": _num(row.eoq),
        "created_at": row.created_at.isoformat() if row.created_at else None,
    }


def list_eoq(db: Session, tenant_id: int, page: int, page_size: int) -> dict:
    page, page_size = _page(page, page_size)
    stmt = select(EoqCalculation).where(EoqCalculation.tenant_id == tenant_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(db.scalars(stmt.order_by(EoqCalculation.id.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return {"items": [_eoq_read(db, row) for row in rows], "total": int(total), "page": page, "page_size": page_size}


def _labour_read(row: GodownLabourEntry, warehouse: Warehouse | None) -> dict:
    return {
        "id": row.id,
        "warehouse_id": row.warehouse_id,
        "warehouse_name": warehouse.name if warehouse else None,
        "work_date": row.work_date.isoformat(),
        "work_type": row.work_type,
        "basis": row.basis,
        "quantity": _num(row.quantity),
        "rate": _num(row.rate),
        "total": _num(row.total),
        "is_estimate": bool(row.is_estimate),
        "cost_status": "estimate" if row.is_estimate else "actual",
        "reference": row.reference,
        "remarks": row.remarks,
        "created_by": row.created_by,
    }


def list_labour(db: Session, tenant_id: int, page: int, page_size: int) -> dict:
    page, page_size = _page(page, page_size)
    stmt = select(GodownLabourEntry).where(GodownLabourEntry.tenant_id == tenant_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(db.scalars(stmt.order_by(GodownLabourEntry.work_date.desc(), GodownLabourEntry.id.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    names = {w.id: w for w in db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).all()}
    return {
        "items": [_labour_read(row, names.get(row.warehouse_id)) for row in rows],
        "total": int(total),
        "page": page,
        "page_size": page_size,
    }


def save_labour(db: Session, tenant_id: int, payload: dict, created_by: str | None, entry_id: int | None = None) -> dict:
    if entry_id is None:
        existing = _reuse(db, GodownLabourEntry, tenant_id, payload.get("client_request_id"))
        if existing:
            warehouse = db.get(Warehouse, existing.warehouse_id) if existing.warehouse_id else None
            return _labour_read(existing, warehouse)
    basis = str(payload.get("basis") or "").strip().lower()
    if basis not in LABOUR_BASIS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a basis of bag, tonne, truck, kg, or hour.")
    quantity = float(payload.get("quantity") or 0)
    rate = float(payload.get("rate") or 0)
    if quantity <= 0 or rate < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Quantity must be greater than zero and rate cannot be negative.")
    work_type = str(payload.get("work_type") or "").strip()
    if not work_type:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Work type is required.")
    warehouse = None
    if payload.get("warehouse_id"):
        warehouse = _require_warehouse(db, tenant_id, int(payload["warehouse_id"]))
    work_date = date.fromisoformat(payload["work_date"])
    if entry_id is None:
        row = GodownLabourEntry(tenant_id=tenant_id, created_by=created_by, client_request_id=_clean_key(payload.get("client_request_id")))
        db.add(row)
    else:
        row = db.scalars(
            select(GodownLabourEntry).where(GodownLabourEntry.id == entry_id, GodownLabourEntry.tenant_id == tenant_id)
        ).first()
        if not row:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Labour entry was not found.")
    row.warehouse_id = warehouse.id if warehouse else None
    row.work_date = work_date
    row.work_type = work_type
    row.basis = basis
    row.quantity = quantity
    row.rate = rate
    row.total = money(quantity * rate)
    row.is_estimate = bool(payload.get("is_estimate"))
    row.reference = _clean_key(payload.get("reference"))
    row.remarks = _clean_key(payload.get("remarks"))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This labour entry was already saved.") from exc
    db.refresh(row)
    return _labour_read(row, warehouse if warehouse else (db.get(Warehouse, row.warehouse_id) if row.warehouse_id else None))


def _plan_read(db: Session, plan: TruckLoadPlan) -> dict:
    warehouse = db.get(Warehouse, plan.warehouse_id)
    lines = list(db.scalars(select(TruckLoadPlanLine).where(TruckLoadPlanLine.plan_id == plan.id)).all())
    detailed = []
    for line in lines:
        item = db.get(InventoryItem, line.item_id)
        detailed.append(
            {
                "item_id": line.item_id,
                "item_name": item.name if item else None,
                "unit": item.unit if item else None,
                "quantity": _num(line.quantity),
                "weight_kg": _num(line.weight_kg),
                "volume_cft": _num(line.volume_cft),
            }
        )
    return {
        "id": plan.id,
        "warehouse_id": plan.warehouse_id,
        "warehouse_name": warehouse.name if warehouse else None,
        "vehicle_label": plan.vehicle_label,
        "capacity_kg": _num(plan.capacity_kg),
        "capacity_cft": _num(plan.capacity_cft),
        "status": plan.status,
        "weight_status": plan.weight_status,
        "volume_status": plan.volume_status,
        "total_units": _num(plan.total_units),
        "total_kg": _num(plan.total_kg),
        "total_cft": _num(plan.total_cft),
        "notes": plan.notes,
        "lines": detailed,
        "stock_moved": False,
    }


def list_truck_plans(db: Session, tenant_id: int, page: int, page_size: int) -> dict:
    page, page_size = _page(page, page_size)
    stmt = select(TruckLoadPlan).where(TruckLoadPlan.tenant_id == tenant_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(db.scalars(stmt.order_by(TruckLoadPlan.id.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return {"items": [_plan_read(db, row) for row in rows], "total": int(total), "page": page, "page_size": page_size}


def save_truck_plan(db: Session, tenant_id: int, payload: dict, created_by: str | None) -> dict:
    existing = _reuse(db, TruckLoadPlan, tenant_id, payload.get("client_request_id"))
    if existing:
        return _plan_read(db, existing)
    warehouse = _require_warehouse(db, tenant_id, int(payload["warehouse_id"]))
    label = str(payload.get("vehicle_label") or "").strip()
    if not label:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Enter the vehicle. Vehicle registrations are not invented.")
    capacity_kg = payload.get("capacity_kg")
    capacity_cft = payload.get("capacity_cft")
    if capacity_kg is not None and float(capacity_kg) <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vehicle weight capacity must be greater than zero when it is set.")
    if capacity_cft is not None and float(capacity_cft) <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vehicle volume capacity must be greater than zero when it is set.")
    raw_lines = payload.get("lines") or []
    if not raw_lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one item from stock.")
    prepared = []
    total_units = 0.0
    total_kg = 0.0
    total_cft = 0.0
    weight_complete = True
    volume_complete = True
    for raw in raw_lines:
        item = _require_item(db, tenant_id, int(raw["item_id"]))
        qty = float(raw.get("quantity") or 0)
        if qty <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Quantity for {item.name} must be greater than zero.")
        available = _on_hand(db, tenant_id, item.id, warehouse.id)
        if qty > available:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"{item.name} has {available:g} {item.unit} in {warehouse.name}. The plan asks for {qty:g}.",
            )
        profile = _profile(db, tenant_id, item.id)
        weight = None
        volume = None
        if profile and profile.weight_kg_per_unit is not None:
            weight = float(profile.weight_kg_per_unit) * qty
            total_kg += weight
        else:
            weight_complete = False
        if profile and profile.volume_cft_per_unit is not None:
            volume = float(profile.volume_cft_per_unit) * qty
            total_cft += volume
        else:
            volume_complete = False
        total_units += qty
        prepared.append((item, qty, weight, volume))
    if weight_complete and capacity_kg is not None and total_kg > float(capacity_kg):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The load is heavier than the vehicle capacity you entered.")
    if volume_complete and capacity_cft is not None and total_cft > float(capacity_cft):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The load is larger than the vehicle volume you entered.")
    plan = TruckLoadPlan(
        tenant_id=tenant_id,
        warehouse_id=warehouse.id,
        vehicle_label=label,
        capacity_kg=float(capacity_kg) if capacity_kg is not None else None,
        capacity_cft=float(capacity_cft) if capacity_cft is not None else None,
        status="draft",
        weight_status="checked" if weight_complete else "incomplete",
        volume_status="checked" if volume_complete else "incomplete",
        total_units=total_units,
        total_kg=round(total_kg, 2) if weight_complete else None,
        total_cft=round(total_cft, 2) if volume_complete else None,
        client_request_id=_clean_key(payload.get("client_request_id")),
        created_by=created_by,
        notes=_clean_key(payload.get("notes")),
    )
    db.add(plan)
    db.flush()
    for item, qty, weight, volume in prepared:
        db.add(
            TruckLoadPlanLine(
                plan_id=plan.id,
                item_id=item.id,
                quantity=qty,
                weight_kg=weight,
                volume_cft=volume,
            )
        )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This load plan was already saved.") from exc
    db.refresh(plan)
    return _plan_read(db, plan)


def list_losses(db: Session, tenant_id: int) -> dict:
    rows = list(
        db.scalars(
            select(StockAdjustment)
            .where(StockAdjustment.tenant_id == tenant_id, StockAdjustment.reason.in_(LOSS_REASONS))
            .order_by(StockAdjustment.id.desc())
        ).all()
    )
    items = []
    for row in rows:
        item = db.get(InventoryItem, row.item_id)
        warehouse = db.get(Warehouse, row.warehouse_id)
        items.append(
            {
                "id": row.id,
                "warehouse_id": row.warehouse_id,
                "warehouse_name": warehouse.name if warehouse else None,
                "item_id": row.item_id,
                "item_name": item.name if item else None,
                "unit": item.unit if item else None,
                "old_qty": row.old_qty,
                "new_qty": row.new_qty,
                "loss_qty": abs(row.difference) if row.difference < 0 else row.difference,
                "reason": row.reason,
                "remarks": row.remarks,
                "status": row.status,
                "adjustment_date": row.adjustment_date.isoformat() if row.adjustment_date else None,
                "approved_by": row.approved_by,
                "value": None,
            }
        )
    return {
        "items": items,
        "value_status": "unavailable",
        "value_reason": "Loss value is not shown because stock valuation is not approved.",
    }


def create_loss(db: Session, tenant_id: int, payload: dict) -> dict:
    reason = str(payload.get("reason") or "").strip().lower()
    if reason not in LOSS_REASONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Reason must be damage, shrinkage, loss, or scrap.")
    warehouse = _require_warehouse(db, tenant_id, int(payload["warehouse_id"]))
    item = _require_item(db, tenant_id, int(payload["item_id"]))
    loss_qty = float(payload.get("quantity") or 0)
    if loss_qty <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Loss quantity must be greater than zero.")
    if not float(loss_qty).is_integer():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Stock adjustments store whole quantities. Enter a whole number of units.",
        )
    available = _on_hand(db, tenant_id, item.id, warehouse.id)
    if not float(available).is_integer():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "On-hand stock for this item is fractional, and the stock adjustment record stores whole units.",
        )
    if loss_qty > available:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Only {available:g} {item.unit} of {item.name} is on hand in {warehouse.name}.",
        )
    pending = db.scalars(
        select(StockAdjustment).where(
            StockAdjustment.tenant_id == tenant_id,
            StockAdjustment.warehouse_id == warehouse.id,
            StockAdjustment.item_id == item.id,
            StockAdjustment.status == "pending",
            StockAdjustment.reason.in_(LOSS_REASONS),
        )
    ).first()
    if pending:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A pending damage or loss adjustment already exists for this item in this godown.",
        )
    new_qty = int(available - loss_qty)
    created = create_adjustment(
        db,
        tenant_id,
        StockAdjustmentCreate(
            warehouse_id=warehouse.id,
            item_id=item.id,
            new_qty=new_qty,
            reason=reason,
            adjustment_date=payload.get("adjustment_date") or date.today().isoformat(),
        ),
    )
    created.remarks = _clean_key(payload.get("remarks"))
    db.commit()
    return list_losses(db, tenant_id)


def _company_tax(db: Session, tenant_id: int) -> float | None:
    settings = db.scalars(select(CompanySettings).where(CompanySettings.tenant_id == tenant_id)).first()
    if not settings or settings.default_gst_pct is None:
        return None
    return float(settings.default_gst_pct)


def _quote_read(db: Session, quote: StorageQuotation) -> dict:
    customer = db.get(Customer, quote.customer_id)
    warehouse = db.get(Warehouse, quote.warehouse_id) if quote.warehouse_id else None
    lines = list(
        db.scalars(select(StorageQuotationLine).where(StorageQuotationLine.quotation_id == quote.id).order_by(StorageQuotationLine.line_no)).all()
    )
    return {
        "id": quote.id,
        "quote_number": quote.quote_number,
        "customer_id": quote.customer_id,
        "customer_name": _customer_name(customer) if customer else None,
        "warehouse_id": quote.warehouse_id,
        "warehouse_name": warehouse.name if warehouse else None,
        "quote_date": quote.quote_date.isoformat(),
        "valid_until": quote.valid_until.isoformat() if quote.valid_until else None,
        "status": quote.status,
        "allowed_statuses": sorted(QUOTE_TRANSITIONS.get(quote.status, set())),
        "subtotal": _num(quote.subtotal),
        "discount": _num(quote.discount),
        "tax_pct": _num(quote.tax_pct),
        "tax_amount": _num(quote.tax_amount),
        "tax_status": quote.tax_status,
        "tax_source": quote.tax_source,
        "total": _num(quote.total),
        "notes": quote.notes,
        "lines": [
            {
                "item_id": line.item_id,
                "description": line.description,
                "quantity": _num(line.quantity),
                "rate": _num(line.rate),
                "amount": _num(line.amount),
            }
            for line in lines
        ],
    }


def list_quotes(db: Session, tenant_id: int, page: int, page_size: int, status_filter: str | None) -> dict:
    page, page_size = _page(page, page_size)
    stmt = select(StorageQuotation).where(StorageQuotation.tenant_id == tenant_id)
    if status_filter:
        stmt = stmt.where(StorageQuotation.status == status_filter)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(db.scalars(stmt.order_by(StorageQuotation.id.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return {"items": [_quote_read(db, row) for row in rows], "total": int(total), "page": page, "page_size": page_size}


def _build_quote_lines(db: Session, tenant_id: int, raw_lines: list[dict]) -> list[dict]:
    if not raw_lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one storage line with a quantity and a rate.")
    prepared = []
    for index, raw in enumerate(raw_lines, start=1):
        item = _require_item(db, tenant_id, int(raw["item_id"])) if raw.get("item_id") else None
        description = str(raw.get("description") or "").strip() or (item.name if item else "")
        if not description:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Each line needs an item or a description.")
        prepared.append(
            {
                "line_no": index,
                "item_id": item.id if item else None,
                "description": description,
                "quantity": float(raw["quantity"]),
                "rate": float(raw["rate"]),
            }
        )
    return prepared


def save_quote(db: Session, tenant_id: int, payload: dict, created_by: str | None, quote_id: int | None = None) -> dict:
    if quote_id is None:
        existing = _reuse(db, StorageQuotation, tenant_id, payload.get("client_request_id"))
        if existing:
            return _quote_read(db, existing)
    customer = _require_customer(db, tenant_id, int(payload["customer_id"]))
    warehouse = _require_warehouse(db, tenant_id, int(payload["warehouse_id"])) if payload.get("warehouse_id") else None
    quote_date = date.fromisoformat(payload["quote_date"])
    valid_until = date.fromisoformat(payload["valid_until"]) if payload.get("valid_until") else None
    if valid_until and valid_until < quote_date:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Valid until cannot be before the quotation date.")
    prepared = _build_quote_lines(db, tenant_id, payload.get("lines") or [])
    discount = float(payload.get("discount") or 0)
    tax_pct = payload.get("tax_pct")
    tax_source = None
    if tax_pct is None and payload.get("use_company_tax"):
        tax_pct = _company_tax(db, tenant_id)
        tax_source = "company_settings" if tax_pct is not None else None
    elif tax_pct is not None:
        tax_source = "entered"
        tax_pct = float(tax_pct)
    try:
        totals = quote_totals(prepared, [], discount, tax_pct)
    except ValueError as exc:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(exc)) from exc
    if quote_id is None:
        quote = StorageQuotation(
            tenant_id=tenant_id,
            quote_number=_next_number(db, StorageQuotation, StorageQuotation.quote_number, tenant_id, "SQ"),
            customer_id=customer.id,
            warehouse_id=warehouse.id if warehouse else None,
            quote_date=quote_date,
            valid_until=valid_until,
            status="draft",
            subtotal=totals["subtotal"],
            discount=totals["discount"],
            tax_pct=totals["tax_pct"],
            tax_amount=totals["tax_amount"],
            tax_status=totals["tax_status"],
            tax_source=tax_source,
            total=totals["total"],
            notes=_clean_key(payload.get("notes")),
            created_by=created_by,
            client_request_id=_clean_key(payload.get("client_request_id")),
        )
        db.add(quote)
        db.flush()
    else:
        quote = db.scalars(
            select(StorageQuotation).where(StorageQuotation.id == quote_id, StorageQuotation.tenant_id == tenant_id)
        ).first()
        if not quote:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Storage quotation was not found.")
        if quote.status != "draft":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only a draft quotation can be edited.")
        db.execute(delete(StorageQuotationLine).where(StorageQuotationLine.quotation_id == quote.id))
    quote.customer_id = customer.id
    quote.warehouse_id = warehouse.id if warehouse else None
    quote.quote_date = quote_date
    quote.valid_until = valid_until
    quote.subtotal = totals["subtotal"]
    quote.discount = totals["discount"]
    quote.tax_pct = totals["tax_pct"]
    quote.tax_amount = totals["tax_amount"]
    quote.tax_status = totals["tax_status"]
    quote.tax_source = tax_source
    quote.total = totals["total"]
    quote.notes = _clean_key(payload.get("notes"))
    for line in prepared:
        amount = money(line["quantity"] * line["rate"])
        db.add(
            StorageQuotationLine(
                quotation_id=quote.id,
                line_no=line["line_no"],
                item_id=line["item_id"],
                description=line["description"],
                quantity=line["quantity"],
                rate=line["rate"],
                amount=amount,
            )
        )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This quotation was already saved.") from exc
    db.refresh(quote)
    return _quote_read(db, quote)


def set_quote_status(db: Session, tenant_id: int, quote_id: int, new_status: str) -> dict:
    quote = db.scalars(
        select(StorageQuotation).where(StorageQuotation.id == quote_id, StorageQuotation.tenant_id == tenant_id)
    ).first()
    if not quote:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Storage quotation was not found.")
    target = new_status.strip().lower()
    if target not in QUOTE_TRANSITIONS.get(quote.status, set()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"A {quote.status} quotation cannot move to {target}.")
    quote.status = target
    db.commit()
    return _quote_read(db, quote)


def _pass_read(db: Session, row: GatePass) -> dict:
    warehouse = db.get(Warehouse, row.warehouse_id) if row.warehouse_id else None
    lines = list(db.scalars(select(GatePassLine).where(GatePassLine.gate_pass_id == row.id).order_by(GatePassLine.line_no)).all())
    detailed = []
    total_qty = 0.0
    total_kg = 0.0
    weight_known = True
    for line in lines:
        item = db.get(InventoryItem, line.item_id)
        total_qty += float(line.quantity)
        if line.weight_kg is None:
            weight_known = False
        else:
            total_kg += float(line.weight_kg)
        detailed.append(
            {
                "item_id": line.item_id,
                "item_name": item.name if item else None,
                "quantity": _num(line.quantity),
                "unit": line.unit,
                "weight_kg": _num(line.weight_kg),
                "remark": line.remark,
            }
        )
    return {
        "id": row.id,
        "document_no": row.document_no,
        "document_type": row.document_type,
        "status": row.status,
        "allowed_statuses": sorted(GATE_PASS_TRANSITIONS.get(row.status, set())),
        "document_date": row.document_date.isoformat(),
        "warehouse_id": row.warehouse_id,
        "warehouse_name": warehouse.name if warehouse else None,
        "customer_id": row.customer_id,
        "party_name": row.party_name,
        "vehicle_no": row.vehicle_no,
        "driver_name": row.driver_name,
        "driver_phone": row.driver_phone,
        "purpose": row.purpose,
        "reference": row.reference,
        "remarks": row.remarks,
        "total_qty": total_qty,
        "total_kg": round(total_kg, 2) if weight_known else None,
        "weight_status": "available" if weight_known else "unavailable",
        "lines": detailed,
        "stock_moved": False,
    }


def list_gate_passes(db: Session, tenant_id: int, page: int, page_size: int) -> dict:
    page, page_size = _page(page, page_size)
    stmt = select(GatePass).where(GatePass.tenant_id == tenant_id)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = list(db.scalars(stmt.order_by(GatePass.id.desc()).offset((page - 1) * page_size).limit(page_size)).all())
    return {"items": [_pass_read(db, row) for row in rows], "total": int(total), "page": page, "page_size": page_size}


def save_gate_pass(db: Session, tenant_id: int, payload: dict, created_by: str | None) -> dict:
    existing = _reuse(db, GatePass, tenant_id, payload.get("client_request_id"))
    if existing:
        return _pass_read(db, existing)
    document_type = str(payload.get("document_type") or "").strip().lower().replace(" ", "_")
    if document_type not in {"gate_pass", "delivery_challan"}:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Document type must be a gate pass or a delivery challan.")
    warehouse = _require_warehouse(db, tenant_id, int(payload["warehouse_id"])) if payload.get("warehouse_id") else None
    customer = _require_customer(db, tenant_id, int(payload["customer_id"])) if payload.get("customer_id") else None
    party = _clean_key(payload.get("party_name")) or (_customer_name(customer) if customer else None)
    if not party:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a customer or enter the party name.")
    raw_lines = payload.get("lines") or []
    if not raw_lines:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Add at least one item.")
    prepared = []
    for index, raw in enumerate(raw_lines, start=1):
        item = _require_item(db, tenant_id, int(raw["item_id"]))
        qty = float(raw.get("quantity") or 0)
        if qty <= 0:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Quantity for {item.name} must be greater than zero.")
        profile = _profile(db, tenant_id, item.id)
        weight = float(profile.weight_kg_per_unit) * qty if profile and profile.weight_kg_per_unit is not None else None
        prepared.append((index, item, qty, weight, _clean_key(raw.get("remark"))))
    row = GatePass(
        tenant_id=tenant_id,
        document_no=_next_number(db, GatePass, GatePass.document_no, tenant_id, "GP"),
        document_type=document_type,
        status="draft",
        document_date=date.fromisoformat(payload["document_date"]),
        warehouse_id=warehouse.id if warehouse else None,
        customer_id=customer.id if customer else None,
        party_name=party,
        vehicle_no=_clean_key(payload.get("vehicle_no")),
        driver_name=_clean_key(payload.get("driver_name")),
        driver_phone=_clean_key(payload.get("driver_phone")),
        purpose=_clean_key(payload.get("purpose")),
        reference=_clean_key(payload.get("reference")),
        remarks=_clean_key(payload.get("remarks")),
        client_request_id=_clean_key(payload.get("client_request_id")),
        created_by=created_by,
    )
    db.add(row)
    db.flush()
    for index, item, qty, weight, remark in prepared:
        db.add(
            GatePassLine(
                gate_pass_id=row.id,
                line_no=index,
                item_id=item.id,
                quantity=qty,
                unit=item.unit,
                weight_kg=weight,
                remark=remark,
            )
        )
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "This gate pass was already saved.") from exc
    db.refresh(row)
    return _pass_read(db, row)


def set_gate_pass_status(db: Session, tenant_id: int, gate_pass_id: int, new_status: str) -> dict:
    row = db.scalars(select(GatePass).where(GatePass.id == gate_pass_id, GatePass.tenant_id == tenant_id)).first()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Gate pass was not found.")
    target = new_status.strip().lower()
    if target not in GATE_PASS_TRANSITIONS.get(row.status, set()):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"A {row.status} document cannot move to {target}.")
    if target == "issued":
        lines = list(db.scalars(select(GatePassLine).where(GatePassLine.gate_pass_id == row.id)).all())
        if row.warehouse_id is None:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Choose a godown before issuing the document.")
        for line in lines:
            available = _on_hand(db, tenant_id, line.item_id, row.warehouse_id)
            if float(line.quantity) > available:
                item = db.get(InventoryItem, line.item_id)
                name = item.name if item else "Item"
                raise HTTPException(
                    status.HTTP_400_BAD_REQUEST,
                    f"{name} does not have enough stock in this godown to issue the document.",
                )
    row.status = target
    db.commit()
    return _pass_read(db, row)


def dashboard(db: Session, tenant_id: int) -> dict:
    warehouses = list(db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id, Warehouse.status == "active")).all())
    capacity_known = all(row.capacity is not None and row.capacity > 0 for row in warehouses) and bool(warehouses)
    used_known = all(row.used_capacity is not None for row in warehouses) and bool(warehouses)
    items = list(
        db.scalars(select(InventoryItem).where(InventoryItem.tenant_id == tenant_id, InventoryItem.is_active.is_(True))).all()
    )
    stock_qty = 0.0
    below_reorder = 0
    reorder_configured = 0
    for item in items:
        qty = _on_hand(db, tenant_id, item.id)
        stock_qty += qty
        if item.reorder_level and item.reorder_level > 0:
            reorder_configured += 1
            if qty < item.reorder_level:
                below_reorder += 1
    month_start = date.today().replace(day=1)
    labour_rows = list(
        db.scalars(
            select(GodownLabourEntry).where(
                GodownLabourEntry.tenant_id == tenant_id,
                GodownLabourEntry.work_date >= month_start,
            )
        ).all()
    )
    actual_labour = money(sum(float(row.total) for row in labour_rows if not row.is_estimate))
    estimate_labour = money(sum(float(row.total) for row in labour_rows if row.is_estimate))
    open_passes = db.scalar(
        select(func.count()).select_from(GatePass).where(
            GatePass.tenant_id == tenant_id,
            GatePass.status.in_(("draft", "issued")),
        )
    ) or 0
    pending_losses = db.scalar(
        select(func.count()).select_from(StockAdjustment).where(
            StockAdjustment.tenant_id == tenant_id,
            StockAdjustment.status == "pending",
            StockAdjustment.reason.in_(LOSS_REASONS),
        )
    ) or 0
    open_quotes = db.scalar(
        select(func.count()).select_from(StorageQuotation).where(
            StorageQuotation.tenant_id == tenant_id,
            StorageQuotation.status.in_(("draft", "sent")),
        )
    ) or 0
    movements = list(
        db.scalars(
            select(StockMovement).where(StockMovement.tenant_id == tenant_id).order_by(StockMovement.id.desc()).limit(8)
        ).all()
    )
    recent_movements = []
    for movement in movements:
        item = db.get(InventoryItem, movement.item_id)
        recent_movements.append(
            {
                "id": movement.id,
                "item_name": item.name if item else None,
                "quantity": _num(movement.quantity),
                "movement_type": movement.movement_type,
                "reference": movement.reference,
                "created_at": movement.created_at.isoformat() if movement.created_at else None,
            }
        )
    return {
        "active_godowns": {"known": True, "value": len(warehouses)},
        "capacity_utilization_pct": {
            "known": capacity_known and used_known,
            "value": round(sum(row.used_capacity or 0 for row in warehouses) / sum(row.capacity or 0 for row in warehouses) * 100, 1)
            if capacity_known and used_known
            else None,
            "reason": None if capacity_known and used_known else "Set a capacity on every active godown before utilization can be shown.",
        },
        "stock_quantity": {"known": True, "value": stock_qty},
        "stock_value": {"known": False, "value": None, "reason": VALUATION_BLOCK_REASON},
        "below_reorder": {
            "known": True,
            "value": below_reorder,
            "configured_items": reorder_configured,
            "reason": None if reorder_configured else "No item has a reorder level above zero.",
        },
        "labour_month_actual": {"known": True, "value": actual_labour, "estimate": estimate_labour},
        "open_gate_passes": {"known": True, "value": int(open_passes)},
        "pending_losses": {"known": True, "value": int(pending_losses), "value_status": "unavailable"},
        "open_quotations": {"known": True, "value": int(open_quotes)},
        "recent_movements": recent_movements,
        "ageing": {"known": False, "reason": "Stock layers do not store a receipt date, so age cannot be calculated."},
        "storage_rent": {"known": False, "reason": "No approved storage-rent rate is configured."},
        "running_cost": {"known": False, "reason": "Rent, power, and staff costs are not stored as godown running costs."},
    }
