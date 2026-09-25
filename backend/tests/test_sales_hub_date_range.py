"""Sales hub reporting period (from_date / to_date)."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.sales import Customer, SalesOrder
from app.services.sales_extended_service import (
    _timestamp_in_period,
    get_sales_hub,
    resolve_sales_hub_period,
)


def test_resolve_sales_hub_period_defaults_to_month_to_today():
    start, end = resolve_sales_hub_period()
    today = date.today()
    assert start == date(today.year, today.month, 1)
    assert end == today


def test_timestamp_in_period_handles_aware_utc():
    ts = datetime(2026, 9, 15, 12, 0, tzinfo=timezone.utc)
    assert _timestamp_in_period(ts, date(2026, 9, 1), date(2026, 9, 30))
    assert not _timestamp_in_period(ts, date(2026, 8, 1), date(2026, 8, 31))


def test_sales_hub_api_rejects_inverted_range(client, register_admin):
    admin = register_admin()
    res = client.get(
        "/sales/hub",
        headers=admin["headers"],
        params={"from_date": "2026-09-23", "to_date": "2026-09-01"},
    )
    assert res.status_code == 400


def test_resolve_sales_hub_period_rejects_inverted_range():
    try:
        resolve_sales_hub_period("2026-09-23", "2026-09-01")
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "from_date" in str(exc).lower()


def test_hub_total_orders_respects_custom_range(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        customer = Customer(tenant_id=tenant_id, name="Range Customer", status="active")
        db.add(customer)
        db.flush()
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_number=f"SO-{uuid.uuid4().hex[:6].upper()}",
                order_date=date(2026, 9, 10),
                status="confirmed",
                total_amount=10_000.0,
            )
        )
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer.id,
                order_number=f"SO-{uuid.uuid4().hex[:6].upper()}",
                order_date=date(2026, 8, 5),
                status="confirmed",
                total_amount=99_000.0,
            )
        )
        db.commit()

        sep_hub = get_sales_hub(
            db, tenant_id, from_date="2026-09-01", to_date="2026-09-30"
        )
        aug_hub = get_sales_hub(
            db, tenant_id, from_date="2026-08-01", to_date="2026-08-31"
        )
        assert sep_hub.total_orders == 1
        assert sep_hub.monthly_revenue == 10_000.0
        assert aug_hub.total_orders == 1
        assert aug_hub.monthly_revenue == 99_000.0
        assert sep_hub.period_from == "2026-09-01"
        assert sep_hub.period_to == "2026-09-30"
    finally:
        db.close()
