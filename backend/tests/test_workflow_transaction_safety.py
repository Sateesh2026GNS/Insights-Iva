"""Transaction safety tests for sales/manufacturing nested-commit fixes."""

from __future__ import annotations

import uuid
from datetime import date
from unittest.mock import patch

import pytest
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.procurement import MaterialRequest
from app.models.product import Product
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.services.manufacturing_workflow_service import confirm_sales_order_workflow
from app.services.procurement_service import create_material_request
from app.schemas.procurement import MaterialRequestCreate, MaterialRequestLineCreate


@pytest.fixture()
def tenant_ctx(register_admin):
    return register_admin()


def _seed_so_with_two_lines(db, tenant_id: int) -> tuple[int, int]:
    customer = Customer(
        tenant_id=tenant_id,
        name=f"Txn Customer {uuid.uuid4().hex[:4]}",
        email=f"txn-{uuid.uuid4().hex[:6]}@example.com",
    )
    db.add(customer)
    db.flush()

    product_ok = Product(
        tenant_id=tenant_id,
        sku=f"SKU-OK-{uuid.uuid4().hex[:4]}",
        name="OK Product",
        unit_price=10.0,
    )
    product_bad = Product(
        tenant_id=tenant_id,
        sku=f"SKU-BAD-{uuid.uuid4().hex[:4]}",
        name="Bad Product",
        unit_price=5.0,
    )
    db.add_all([product_ok, product_bad])
    db.flush()

    so = SalesOrder(
        tenant_id=tenant_id,
        customer_id=customer.id,
        order_number=f"SO-TXN-{uuid.uuid4().hex[:6].upper()}",
        order_date=date.today(),
        status="draft",
        total_amount=150.0,
    )
    db.add(so)
    db.flush()
    db.add_all(
        [
            SalesOrderLine(
                sales_order_id=so.id,
                product_id=product_ok.id,
                item_description="Line 1",
                quantity=10,
                unit_price=10.0,
                line_total=100.0,
            ),
            SalesOrderLine(
                sales_order_id=so.id,
                product_id=product_bad.id,
                item_description="Line 2",
                quantity=10,
                unit_price=5.0,
                line_total=50.0,
            ),
        ]
    )
    db.commit()
    return so.id, tenant_id


def test_create_material_request_commit_false_does_not_persist(tenant_ctx):
    db = SessionLocal()
    tenant_id = tenant_ctx["user"]["tenant_id"]
    try:
        before = db.scalar(select(func.count(MaterialRequest.id))) or 0
        mr = create_material_request(
            db,
            MaterialRequestCreate(
                tenant_id=tenant_id,
                mr_number=f"MR-TEST-{uuid.uuid4().hex[:6]}",
                request_date=date.today(),
                requested_by="Test",
                status="pending",
                line_items=[],
            ),
            commit=False,
        )
        assert mr.id is not None
        db.rollback()
    finally:
        db.close()

    db = SessionLocal()
    try:
        after = db.scalar(select(func.count(MaterialRequest.id))) or 0
        assert after == before
    finally:
        db.close()


def test_confirm_sales_order_rolls_back_on_mid_workflow_failure(tenant_ctx):
    db = SessionLocal()
    tenant_id = tenant_ctx["user"]["tenant_id"]
    so_id, _ = _seed_so_with_two_lines(db, tenant_id)
    before_status = db.get(SalesOrder, so_id).status

    call_count = 0

    def flaky_run_mrp(db, tenant_id, product_id, quantity, **kwargs):
        nonlocal call_count
        call_count += 1
        if call_count == 1:
            create_material_request(
                db,
                MaterialRequestCreate(
                    tenant_id=tenant_id,
                    mr_number=f"MR-FLAKY-{uuid.uuid4().hex[:6]}",
                    request_date=date.today(),
                    requested_by="Test",
                    status="pending",
                    line_items=[],
                ),
                commit=False,
            )
            return {
                "product_id": product_id,
                "enough_stock": False,
                "shortage_count": 1,
                "requirements": [],
                "material_request_id": None,
            }
        raise RuntimeError("simulated MRP failure")

    from fastapi import HTTPException

    with patch(
        "app.services.manufacturing_workflow_service.run_mrp",
        side_effect=flaky_run_mrp,
    ):
        with pytest.raises(HTTPException):
            confirm_sales_order_workflow(
                db,
                tenant_id,
                so_id,
                create_production=False,
                run_mrp_and_pr=True,
            )

    db.close()
    db = SessionLocal()
    so = db.get(SalesOrder, so_id)
    assert so.status == before_status
    db.close()


def test_confirm_sales_order_success_commits_once(tenant_ctx):
    db = SessionLocal()
    tenant_id = tenant_ctx["user"]["tenant_id"]
    customer = Customer(
        tenant_id=tenant_id,
        name=f"OK Customer {uuid.uuid4().hex[:4]}",
        email=f"ok-{uuid.uuid4().hex[:6]}@example.com",
    )
    db.add(customer)
    db.flush()
    product = Product(
        tenant_id=tenant_id,
        sku=f"SKU-SOLO-{uuid.uuid4().hex[:4]}",
        name="Solo Product",
        unit_price=10.0,
    )
    db.add(product)
    db.flush()
    so = SalesOrder(
        tenant_id=tenant_id,
        customer_id=customer.id,
        order_number=f"SO-OK-{uuid.uuid4().hex[:6].upper()}",
        order_date=date.today(),
        status="draft",
        total_amount=100.0,
    )
    db.add(so)
    db.flush()
    db.add(
        SalesOrderLine(
            sales_order_id=so.id,
            product_id=product.id,
            item_description="Only line",
            quantity=5,
            unit_price=10.0,
            line_total=50.0,
        )
    )
    db.commit()
    so_id = so.id
    db.close()

    db = SessionLocal()
    result = confirm_sales_order_workflow(
        db,
        tenant_id,
        so_id,
        create_production=False,
        run_mrp_and_pr=False,
    )
    assert result["status"] == "confirmed"
    so = db.get(SalesOrder, so_id)
    assert so.status == "confirmed"
    db.close()
