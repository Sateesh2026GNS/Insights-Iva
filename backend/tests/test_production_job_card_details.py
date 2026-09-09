"""Production job card extended details — persistence and validation."""

from __future__ import annotations

import json
import uuid
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.manufacturing_workflow import SalesJobCard
from app.models.product import Product
from app.models.sales import Customer, SalesOrder
from app.services.job_card_details import parse_details_json, validate_details


def _ensure_customer_and_product(tenant_id: int) -> tuple[int, int]:
    db = SessionLocal()
    try:
        customer = db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                Customer.name == "JC Production Test Customer",
            )
        ).first()
        if not customer:
            customer = Customer(
                tenant_id=tenant_id,
                name="JC Production Test Customer",
                email="jc-prod@example.com",
                status="active",
            )
            db.add(customer)
            db.flush()

        product = db.scalars(
            select(Product).where(
                Product.tenant_id == tenant_id,
                Product.sku == "JC-PROD-001",
            )
        ).first()
        if not product:
            product = Product(
                tenant_id=tenant_id,
                sku="JC-PROD-001",
                name="Production JC Product",
                unit_price=10.0,
                unit_cost=5.0,
            )
            db.add(product)
            db.flush()

        db.commit()
        return customer.id, product.id
    finally:
        db.close()


def _create_confirmed_sales_order(client, headers, customer_id: int, product_id: int) -> int:
    order_number = f"SO-JCP-{uuid.uuid4().hex[:6].upper()}"
    resp = client.post(
        "/sales/sales-orders",
        headers=headers,
        json={
            "tenant_id": 1,
            "customer_id": customer_id,
            "order_number": order_number,
            "order_date": date.today().isoformat(),
            "status": "draft",
            "priority": "medium",
            "delivery_date": "2026-12-31",
            "line_items": [
                {
                    "product_id": product_id,
                    "item_description": "Production JC Product",
                    "quantity": 100,
                    "unit": "Nos",
                    "unit_price": 10.0,
                    "line_total": 1000.0,
                }
            ],
        },
    )
    assert resp.status_code == 200, resp.text
    order_id = resp.json()["id"]
    confirm = client.post(f"/sales/sales-orders/{order_id}/confirm", headers=headers)
    assert confirm.status_code == 200, confirm.text
    return order_id


def test_validate_slitting_requires_size():
    details = parse_details_json(None)
    details["production"]["process"] = "Slitting"
    details["production"]["slitting_size"] = ""
    errors = validate_details(
        details,
        editable_sections=["production"],
        job_card_created=True,
    )
    assert "details.production.slitting_size" in errors


def test_create_job_card_with_production_details(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_confirmed_sales_order(client, admin["headers"], customer_id, product_id)

    payload = {
        "customer_id": customer_id,
        "product_id": product_id,
        "quantity": 100,
        "unit": "Nos",
        "required_delivery_date": "2026-12-31",
        "priority": "high",
        "details": {
            "job_info": {"location": "Plant A", "local_type": "local"},
            "production": {
                "process": "Slitting",
                "machine_name": "Slitter 01",
                "planned_quantity": 100,
                "uom": "Nos",
                "slitting_size": "158 X 1 + 127 X 1",
            },
        },
    }
    create_resp = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=admin["headers"],
        json=payload,
    )
    if create_resp.status_code == 400 and "already created" in create_resp.text.lower():
        create_resp = client.patch(
            f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
            headers=admin["headers"],
            json={"details": payload["details"]},
        )
    assert create_resp.status_code == 200, create_resp.text
    body = create_resp.json()
    assert body.get("details", {}).get("job_info", {}).get("location") == "Plant A"
    assert body.get("details", {}).get("production", {}).get("slitting_size") == "158 X 1 + 127 X 1"

    db = SessionLocal()
    try:
        jc = db.scalars(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant_id,
                SalesJobCard.sales_order_id == order_id,
            )
        ).first()
        assert jc is not None
        assert jc.details_json
        stored = json.loads(jc.details_json)
        assert stored["production"]["process"] == "Slitting"
    finally:
        db.close()

    get_resp = client.get(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=admin["headers"],
    )
    assert get_resp.status_code == 200
    assert get_resp.json()["details"]["production"]["machine_name"] == "Slitter 01"
    sd = get_resp.json().get("sales_document") or {}
    assert sd.get("customer_details", {}).get("customer_name")
    assert isinstance(sd.get("product_lines"), list)


def test_patch_production_details_only(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    customer_id, product_id = _ensure_customer_and_product(tenant_id)
    order_id = _create_confirmed_sales_order(client, admin["headers"], customer_id, product_id)

    base_payload = {
        "customer_id": customer_id,
        "product_id": product_id,
        "quantity": 50,
        "unit": "Nos",
        "required_delivery_date": "2026-12-31",
        "priority": "medium",
    }
    create_resp = client.post(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=admin["headers"],
        json=base_payload,
    )
    if create_resp.status_code == 400 and "already created" in create_resp.text.lower():
        pass
    else:
        assert create_resp.status_code == 200, create_resp.text

    patch_resp = client.patch(
        f"/manufacturing/workflow/sales-orders/{order_id}/job-card",
        headers=admin["headers"],
        json={
            "details": {
                "output": {
                    "good_quantity": 48,
                    "rejected_quantity": 2,
                    "output_uom": "Nos",
                },
            },
        },
    )
    assert patch_resp.status_code == 200, patch_resp.text
    out = patch_resp.json()["details"]["output"]
    assert float(out["good_quantity"]) == 48.0
    assert float(out["rejected_quantity"]) == 2.0
