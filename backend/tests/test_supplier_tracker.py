"""Supplier & Vendor Master Tracker aggregates and access control."""

from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.services.supplier_tracker_service import (
    build_supplier_tracker,
    is_at_risk,
    is_compliant,
    trade_bucket,
)


def _supplier(**kwargs):
    defaults = dict(
        name="Acme",
        vendor_type="Raw Material Supplier",
        country="India",
        category="Chemicals",
        status="active",
        approval_status="approved",
        gstin=None,
        pan=None,
        rating=None,
        payment_terms="Net 30",
        created_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
        updated_at=datetime(2026, 4, 1, tzinfo=timezone.utc),
    )
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_trade_buckets_use_country_and_vendor_type():
    assert trade_bucket(_supplier(country="Germany")) == "Import Suppliers"
    assert trade_bucket(_supplier(country="Germany", vendor_type="Service Provider")) == "Export Service Vendors"
    assert trade_bucket(_supplier(country="India", vendor_type="Service Provider")) == "Domestic Service Vendors"
    assert trade_bucket(_supplier(country="India")) == "Others"
    assert trade_bucket(_supplier(country=None)) == "Others"


def test_compliant_and_at_risk_rules():
    assert is_compliant(_supplier(gstin="22AAAAA0000A1Z5")) is True
    assert is_compliant(_supplier()) is False
    assert is_at_risk(_supplier(status="blacklisted")) is True
    assert is_at_risk(_supplier(approval_status="pending")) is True
    assert is_at_risk(_supplier(rating=2.4)) is True
    assert is_at_risk(_supplier(rating=4)) is False


def test_empty_tracker_has_zero_counts_and_no_fake_deltas():
    tracker = build_supplier_tracker([])
    assert tracker.header.total_suppliers == 0
    assert tracker.header.last_updated is None
    assert tracker.kpis[4].value is None
    assert tracker.by_country == []
    assert tracker.activities == []
    assert all(bucket.count == 0 for bucket in tracker.by_rating)
    payload = tracker.model_dump()
    assert "percent" not in str(payload).lower()


def test_tracker_aggregates_real_fields_only():
    rows = [
        _supplier(name="Harbor", country="Germany", rating=4, category="Chemicals"),
        _supplier(
            name="Coastal",
            country="Singapore",
            vendor_type="Service Provider",
            rating=5,
            payment_terms="Advance",
            gstin="22AAAAA0000A1Z5",
            updated_at=datetime(2026, 4, 20, tzinfo=timezone.utc),
        ),
    ]
    order = SimpleNamespace(
        order_date=date(2026, 4, 18),
        supplier_name="Harbor",
        po_number="PO-1",
        status="approved",
    )
    tracker = build_supplier_tracker(rows, [order])
    assert tracker.header.total_suppliers == 2
    assert tracker.header.import_suppliers == 1
    assert tracker.header.export_service_vendors == 1
    assert tracker.header.countries_served == 2
    assert tracker.header.suppliers_at_risk == 0
    assert tracker.kpis[4].value == 4.5
    labels = {row.label: row.count for row in tracker.by_category}
    assert labels["Chemicals"] == 2
    assert any(item.activity == "Purchase order" and item.details == "PO-1" for item in tracker.activities)
    assert any(item.activity == "Supplier updated" and item.supplier_name == "Coastal" for item in tracker.activities)


def _vendor_payload(tenant_id, name, phone):
    return {
        "tenant_id": tenant_id,
        "name": name,
        "contact": "Ada Lovelace",
        "email": f"{phone}@vendors.test",
        "phone": phone,
        "country": "Germany",
        "vendor_type": "Raw Material Supplier",
        "category": "Metals",
        "payment_terms": "Net 30",
        "status": "active",
        "rating": 4,
    }


@pytest.fixture()
def admin(client, register_admin):
    return register_admin()


def test_tracker_api_empty_then_counts_created_vendor(client, admin):
    empty = client.get("/procurement/vendors/tracker", headers=admin["headers"])
    assert empty.status_code == 200, empty.text
    assert empty.json()["header"]["total_suppliers"] == 0

    created = client.post(
        "/procurement/vendors",
        headers=admin["headers"],
        json=_vendor_payload(admin["user"]["tenant_id"], "Harbor Metals", "9876543210"),
    )
    assert created.status_code == 200, created.text
    vendor_id = created.json()["id"]

    tracker = client.get("/procurement/vendors/tracker", headers=admin["headers"])
    assert tracker.status_code == 200, tracker.text
    body = tracker.json()
    assert body["header"]["total_suppliers"] == 1
    assert body["header"]["import_suppliers"] == 1
    assert body["header"]["countries_served"] == 1
    assert body["kpis"][4]["value"] == 4

    updated = client.put(
        f"/procurement/vendors/{vendor_id}",
        headers=admin["headers"],
        json={"category": "Alloys", "country": "Germany"},
    )
    assert updated.status_code == 200, updated.text
    refreshed = client.get("/procurement/vendors/tracker", headers=admin["headers"])
    categories = {row["label"]: row["count"] for row in refreshed.json()["by_category"]}
    assert categories.get("Alloys") == 1

    exported = client.get("/procurement/vendors/export", headers=admin["headers"], params={"format": "pdf"})
    assert exported.status_code == 200, exported.text
    assert exported.json()["count"] == 1
    assert exported.json()["vendors"][0]["name"] == "Harbor Metals"


def test_tracker_rejects_duplicate_phone(client, admin):
    payload = _vendor_payload(admin["user"]["tenant_id"], "Harbor Metals", "9876543211")
    first = client.post("/procurement/vendors", headers=admin["headers"], json=payload)
    assert first.status_code == 200, first.text
    second = client.post(
        "/procurement/vendors",
        headers=admin["headers"],
        json=_vendor_payload(admin["user"]["tenant_id"], "Harbor Metals Copy", "9876543211"),
    )
    assert second.status_code == 400


def test_tracker_is_tenant_isolated_and_role_gated(client, register_admin, make_restricted_user):
    first = register_admin()
    second = register_admin()
    created = client.post(
        "/procurement/vendors",
        headers=first["headers"],
        json=_vendor_payload(first["user"]["tenant_id"], "Private Mill", "9876543212"),
    )
    assert created.status_code == 200, created.text
    other = client.get("/procurement/vendors/tracker", headers=second["headers"])
    assert other.status_code == 200
    assert other.json()["header"]["total_suppliers"] == 0

    limited = make_restricted_user(first["user"]["tenant_id"], ["dashboard"])
    denied = client.get("/procurement/vendors/tracker", headers=limited["headers"])
    assert denied.status_code == 403
