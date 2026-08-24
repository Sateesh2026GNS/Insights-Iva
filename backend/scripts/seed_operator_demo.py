#!/usr/bin/env python3
"""Seed a demo sales order at PRODUCTION_ASSIGNED for operator E2E testing.

Creates (or reuses) a sales order, walks it through inventory → store → production
assignment, and assigns it to the default operator account (operator@gnsinsights.com).

Usage (from backend/):
  python scripts/seed_operator_demo.py
  python scripts/seed_operator_demo.py --reset   # delete prior demo order and recreate
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from dotenv import load_dotenv

load_dotenv(BACKEND_ROOT / ".env")

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import SessionLocal
from app.core.seed_tenant import seed_tenant
from app.core.seed_users import seed_admin_user
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.models.machine import Machine
from app.models.product import Product
from app.models.user import User
from app.services.workflow_team_service import (
    assign_operator_to_work_order,
    confirm_sales_order_with_workflow,
    submit_material_check,
    submit_store_material_issue,
)

DEMO_ORDER_NUMBER = "SO-DEMO-OP-001"


def _get_user(db: Session, tenant_id: int, email: str) -> User:
    user = db.scalars(
        select(User).where(User.tenant_id == tenant_id, User.email == email)
    ).first()
    if not user:
        raise SystemExit(f"User not found: {email}. Run app startup seed first.")
    return user


def _get_or_create_customer(db: Session, tenant_id: int) -> Customer:
    customer = db.scalars(
        select(Customer).where(Customer.tenant_id == tenant_id).limit(1)
    ).first()
    if customer:
        return customer
    customer = Customer(
        tenant_id=tenant_id,
        name="ABC Manufacturing",
        email="orders@abc-mfg.example",
        phone="9876543210",
    )
    db.add(customer)
    db.flush()
    return customer


def _get_or_create_product(db: Session, tenant_id: int) -> Product:
    product = db.scalars(
        select(Product).where(Product.tenant_id == tenant_id).limit(1)
    ).first()
    if product:
        return product
    product = Product(
        tenant_id=tenant_id,
        name="Industrial Gear Assembly",
        sku="GA-1025",
        unit="Nos",
        sale_price=1500,
    )
    db.add(product)
    db.flush()
    return product


def _ensure_demo_material_lines(db: Session, mc) -> None:
    """Add sample BOM lines when product has no BOM (local E2E demo)."""
    from app.models.manufacturing_workflow import SalesOrderMaterialCheckLine

    if not mc or mc.lines:
        return
    samples = [
        ("Steel Sheet", 100.0, 120.0),
        ("Bolt M10", 500.0, 500.0),
        ("Gear Shaft", 500.0, 450.0),
    ]
    for name, required, available in samples:
        shortage = max(0.0, required - available)
        db.add(
            SalesOrderMaterialCheckLine(
                material_check_id=mc.id,
                material_name=name,
                required_qty=required,
                available_qty=available,
                shortage_qty=shortage,
                is_available=shortage <= 0,
                stock_location="Main Store",
            )
        )
    db.flush()


def _delete_demo_order(db: Session, tenant_id: int) -> None:
    existing = db.scalars(
        select(SalesOrder).where(
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.order_number == DEMO_ORDER_NUMBER,
        )
    ).first()
    if not existing:
        return
    print(
        f"Note: --reset cannot auto-delete {DEMO_ORDER_NUMBER} (linked workflow records). "
        "Continue seeding from current workflow status instead."
    )


def _load_material_check(db: Session, sales_order_id: int):
    from app.models.manufacturing_workflow import SalesOrderMaterialCheck

    return db.scalars(
        select(SalesOrderMaterialCheck)
        .options(selectinload(SalesOrderMaterialCheck.lines))
        .where(SalesOrderMaterialCheck.sales_order_id == sales_order_id)
    ).first()


def seed_operator_demo(*, reset: bool = False, tenant_id: int = 1) -> dict:
    db = SessionLocal()
    try:
        seed_tenant(db)
        seed_admin_user(db, tenant_id)
        if reset:
            _delete_demo_order(db, tenant_id)

        admin = _get_user(db, tenant_id, "admin@gnsinsights.com")
        operator = _get_user(db, tenant_id, "operator@gnsinsights.com")
        customer = _get_or_create_customer(db, tenant_id)
        product = _get_or_create_product(db, tenant_id)

        so = db.scalars(
            select(SalesOrder)
            .options(selectinload(SalesOrder.line_items))
            .where(
                SalesOrder.tenant_id == tenant_id,
                SalesOrder.order_number == DEMO_ORDER_NUMBER,
            )
        ).first()

        if so and so.workflow_status in {"PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"}:
            wo_id = None
            from app.models.production import ProductionOrder, WorkOrder

            po = db.scalars(
                select(ProductionOrder).where(
                    ProductionOrder.tenant_id == tenant_id,
                    ProductionOrder.sales_order_id == so.id,
                )
            ).first()
            if po:
                wo = db.scalars(
                    select(WorkOrder).where(WorkOrder.production_order_id == po.id)
                ).first()
                wo_id = wo.id if wo else None
            print(f"Demo order already at {so.workflow_status} (order_id={so.id})")
            return {
                "sales_order_id": so.id,
                "order_number": so.order_number,
                "workflow_status": so.workflow_status,
                "work_order_id": wo_id,
                "operator_email": operator.email,
            }

        if not so:
            delivery = date.today() + timedelta(days=14)
            so = SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_number=DEMO_ORDER_NUMBER,
                order_date=date.today(),
                status="draft",
                total_amount=750000,
                delivery_date=delivery,
                priority="high",
                sales_person="Demo Sales",
            )
            db.add(so)
            db.flush()
            db.add(
                SalesOrderLine(
                    sales_order_id=so.id,
                    product_id=product.id,
                    item_description=product.name,
                    quantity=500,
                    unit="Nos",
                    unit_price=1500,
                    line_total=750000,
                )
            )
            db.commit()
            db.refresh(so)
            print(f"Created demo sales order {DEMO_ORDER_NUMBER} (id={so.id})")

        confirm_sales_order_with_workflow(db, tenant_id, so.id, admin, run_mrp_and_pr=False)
        db.refresh(so)
        print(f"Confirmed -> {so.workflow_status}")

        mc = _load_material_check(db, so.id)
        _ensure_demo_material_lines(db, mc)
        mc = _load_material_check(db, so.id)

        if (so.workflow_status or "").upper() == "MATERIAL_CHECK_PENDING":
            line_updates = []
            if mc:
                for ln in mc.lines:
                    req = float(ln.required_qty or 0)
                    line_updates.append(
                        {
                            "id": ln.id,
                            "available_qty": max(req, float(ln.available_qty or 0)),
                            "stock_location": ln.stock_location or "Main Store",
                        }
                    )
            submit_material_check(db, tenant_id, so.id, admin, line_updates=line_updates)
            db.refresh(so)
            print(f"Material check -> {so.workflow_status}")

        from app.services.stage_job_card_service import get_stage_card, _ensure_store_issue_lines

        ws = (so.workflow_status or "").upper()
        if ws in {"STORE_ISSUE_PENDING", "STORE_ISSUE_PARTIAL", "MATERIAL_AVAILABLE"}:
            mc = _load_material_check(db, so.id)
            _ensure_demo_material_lines(db, mc)
            mc = _load_material_check(db, so.id)
            store_card = get_stage_card(db, tenant_id, so.id, "store")
            if not store_card and mc:
                from app.services.stage_job_card_service import ensure_stage_card

                store_card = ensure_stage_card(
                    db, tenant_id, so.id, "store", material_check_id=mc.id, status="pending"
                )
            if store_card and mc:
                _ensure_store_issue_lines(db, store_card, mc)
                db.refresh(store_card)
                issue_lines = [
                    {
                        "id": ln.id,
                        "issued_qty": float(ln.required_qty),
                        "store_location": ln.store_location or "Main Store",
                    }
                    for ln in store_card.issue_lines
                ]
                if issue_lines:
                    submit_store_material_issue(
                        db,
                        tenant_id,
                        so.id,
                        admin,
                        line_updates=issue_lines,
                        send_to_production=True,
                    )
                    db.refresh(so)
                    print(f"Store issue -> {so.workflow_status}")
                else:
                    print("Warning: no store issue lines — add a BOM or re-run after fixing materials")

        ws = (so.workflow_status or "").upper()
        if ws in {"READY_FOR_PRODUCTION", "PRODUCTION_ASSIGNED", "PRODUCTION_IN_PROGRESS"}:
            from app.models.production import ProductionOrder, WorkOrder

            po = db.scalars(
                select(ProductionOrder).where(
                    ProductionOrder.tenant_id == tenant_id,
                    ProductionOrder.sales_order_id == so.id,
                )
            ).first()
            wo = (
                db.scalars(select(WorkOrder).where(WorkOrder.production_order_id == po.id)).first()
                if po
                else None
            )

            if not wo:
                raise SystemExit("Work order was not created — check store issue step.")

            if ws == "READY_FOR_PRODUCTION":
                machine = db.scalars(
                    select(Machine).where(
                        Machine.tenant_id == tenant_id, Machine.is_active.is_(True)
                    ).limit(1)
                ).first()

                planned_end = datetime.now(timezone.utc) + timedelta(days=3)
                assign_operator_to_work_order(
                    db,
                    tenant_id,
                    wo.id,
                    admin,
                    operator_user_id=operator.id,
                    machine_id=machine.id if machine else None,
                    planned_end=planned_end,
                    planned_quantity=500,
                )
                db.refresh(so)

            from app.services.stage_job_card_service import get_stage_card
            import json

            pm_card = get_stage_card(db, tenant_id, so.id, "production_manager")
            if pm_card:
                pm_card.payload_json = json.dumps(
                    {
                        "operation": "Gear Cutting",
                        "work_instructions": "Maintain cutting tolerance ±0.05 mm.",
                        "special_instructions": "Check first 5 pieces before continuing production.",
                        "safety_instructions": "Wear safety glasses and gloves. Keep hands clear of CNC spindle.",
                        "standard_production_time": "8 hours",
                    }
                )
                db.commit()

            op_card = get_stage_card(db, tenant_id, so.id, "operator")
            print("\n[OK] Operator demo ready")
            print(f"  Sales order:  {so.order_number} (id={so.id})")
            print(f"  Work order:   {wo.work_order_number} (id={wo.id})")
            print(f"  Status:       {so.workflow_status}")
            print(f"  Operator:     {operator.email} / Operator123!")
            print(f"  Operator JC:  {op_card.card_number if op_card else '-'}")
            print(f"  Open UI:      /manufacturing/workflow/order/{so.id}/operator")
            print(f"  My Jobs:      /production/operator-jobs")

            return {
                "sales_order_id": so.id,
                "order_number": so.order_number,
                "workflow_status": so.workflow_status,
                "work_order_id": wo.id,
                "operator_job_card_no": op_card.card_number if op_card else None,
                "operator_email": operator.email,
            }

        raise SystemExit(f"Demo order stuck at workflow status {so.workflow_status}")
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Seed operator demo workflow order")
    parser.add_argument("--reset", action="store_true", help="Delete and recreate demo order")
    parser.add_argument("--tenant-id", type=int, default=1)
    args = parser.parse_args()
    seed_operator_demo(reset=args.reset, tenant_id=args.tenant_id)


if __name__ == "__main__":
    main()
