"""Sales hub dashboard — executive vs customer data and KPI consistency."""

from __future__ import annotations

from datetime import date

from app.core.database import SessionLocal
from app.models.sales import Customer, Invoice, Quotation, SalesOrder
from app.services.sales_extended_service import get_sales_hub


def _seed_sales_hub_fixtures(tenant_id: int) -> tuple[Customer, SalesOrder]:
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Hub Test Customer", status="active")
        db.add(customer)
        db.flush()
        other = Customer(tenant_id=tenant_id, name="Other Customer", status="active")
        db.add(other)
        db.flush()

        so = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number="SO-HUB-001",
            order_date=date.today(),
            status="confirmed",
            total_amount=893850.0,
            sales_person="Executive Alpha",
        )
        db.add(so)
        db.add(
            Invoice(
                tenant_id=tenant_id,
                customer_id=customer.id,
                sales_order_id=so.id,
                invoice_number="INV-HUB-001",
                issue_date=date.today(),
                due_date=date.today(),
                grand_total=893850.0,
                amount_paid=0,
                status="sent",
            )
        )
        db.add(
            Quotation(
                tenant_id=tenant_id,
                quote_number="QT-HUB-001",
                customer_name="Hub Test Customer",
                quote_date=date.today(),
                status="sent",
                total_amount=100000.0,
            )
        )
        db.commit()
        return customer, so
    finally:
        db.close()


def test_sales_hub_executive_differs_from_top_customers(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    _seed_sales_hub_fixtures(tenant_id)

    db = SessionLocal()
    try:
        hub = get_sales_hub(db, tenant_id)
    finally:
        db.close()

    assert hub.total_orders >= 1
    assert hub.outstanding_payments >= 893850.0
    assert hub.monthly_revenue >= 893850.0
    assert hub.open_quotations >= 1
    assert hub.top_customers
    assert hub.top_customers[0]["name"] == "Hub Test Customer"
    assert hub.top_customers[0]["orders"] >= 1

    assert hub.sales_executive_performance
    assert hub.sales_executive_performance[0]["name"] == "Executive Alpha"
    assert hub.sales_executive_performance[0]["name"] != hub.top_customers[0]["name"]

    names_match_customer_list = all(
        row["name"] in {"Hub Test Customer", "Other Customer"} for row in hub.sales_executive_performance
    )
    assert not names_match_customer_list


def test_sales_hub_api(register_admin, client):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    _seed_sales_hub_fixtures(tenant_id)

    res = client.get("/sales/hub", headers=admin["headers"])
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["open_leads"] is not None
    assert "conversion_rate" in body
    assert body["total_orders"] >= 1
