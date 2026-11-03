"""Live godown toolkit: no sample catalogues, tenant isolation, and stock rules."""

from app.core.database import SessionLocal
from app.models.sales import Customer
from app.services.godown_toolkit_calc import compute_eoq, convert_quantity, quote_totals


def test_convert_and_eoq_do_not_invent_cross_dimension_values():
    blocked = convert_quantity(10, "kg", "litre")
    assert blocked["ok"] is False
    mass = convert_quantity(2, "tonne", "kg")
    assert mass["ok"] is True
    assert mass["value"] == 2000
    assert compute_eoq(1000, 50, 2) == 223.60679774997897 or round(compute_eoq(1000, 50, 2), 2) == 223.61
    totals = quote_totals([{"quantity": 2, "rate": 10}], [], 0, None)
    assert totals["tax_amount"] is None
    assert totals["total"] == 20


def _item(client, headers, sku, unit="kg", unit_cost=None):
    body = {
        "tenant_id": 1,
        "sku": sku,
        "name": sku,
        "unit": unit,
        "reorder_level": 0,
        "item_type": "raw_material",
    }
    if unit_cost is not None:
        body["unit_cost"] = unit_cost
    response = client.post("/inventory/items", json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def _warehouse(client, headers, code, capacity=None):
    body = {"tenant_id": 1, "name": code, "code": code, "capacity": capacity}
    response = client.post("/inventory/warehouses", json=body, headers=headers)
    assert response.status_code == 200, response.text
    return response.json()


def test_dashboard_and_valuation_use_real_records(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    warehouse = _warehouse(client, headers, "GD-1", capacity=100)
    item = _item(client, headers, "RM-1", unit="kg", unit_cost=25)
    stock = client.post(
        "/inventory/stock-levels",
        json={"warehouse_id": warehouse["id"], "item_id": item["id"], "quantity": 20},
        headers=headers,
    )
    assert stock.status_code == 200, stock.text

    dashboard = client.get("/inventory/godown-toolkit/dashboard", headers=headers)
    assert dashboard.status_code == 200, dashboard.text
    body = dashboard.json()
    assert body["active_godowns"]["value"] == 1
    assert body["stock_quantity"]["value"] == 20
    assert body["stock_value"]["known"] is False
    assert body["stock_value"]["value"] is None
    assert body["open_gate_passes"]["value"] == 0
    assert body["ageing"]["known"] is False

    valuation = client.get("/inventory/godown-toolkit/valuation", headers=headers)
    assert valuation.status_code == 200
    assert valuation.json()["status"] == "blocked"
    assert valuation.json()["value_total"] is None
    assert valuation.json()["lines"][0]["quantity"] == 20
    assert valuation.json()["lines"][0]["value"] is None


def test_conversion_truck_loss_and_gate_pass(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    warehouse = _warehouse(client, headers, "GD-2", capacity=50)
    item = _item(client, headers, "BAG-1", unit="bag")
    client.post(
        "/inventory/stock-levels",
        json={"warehouse_id": warehouse["id"], "item_id": item["id"], "quantity": 10},
        headers=headers,
    )
    missing = client.get(
        "/inventory/godown-toolkit/convert",
        params={"item_id": item["id"], "quantity": 4, "to_unit": "kg"},
        headers=headers,
    )
    assert missing.status_code == 400

    profile = client.put(
        f"/inventory/godown-toolkit/items/{item['id']}/profile",
        json={"weight_kg_per_unit": 50},
        headers=headers,
    )
    assert profile.status_code == 200, profile.text
    converted = client.get(
        "/inventory/godown-toolkit/convert",
        params={"item_id": item["id"], "quantity": 4, "to_unit": "kg"},
        headers=headers,
    )
    assert converted.status_code == 200
    assert converted.json()["converted"] == 200

    too_much = client.post(
        "/inventory/godown-toolkit/truck-plans",
        json={
            "warehouse_id": warehouse["id"],
            "vehicle_label": "RJ 14 GE 3317",
            "capacity_kg": 1000,
            "lines": [{"item_id": item["id"], "quantity": 11}],
            "client_request_id": "truck-over",
        },
        headers=headers,
    )
    assert too_much.status_code == 400

    plan = client.post(
        "/inventory/godown-toolkit/truck-plans",
        json={
            "warehouse_id": warehouse["id"],
            "vehicle_label": "RJ 14 GE 3317",
            "capacity_kg": 1000,
            "lines": [{"item_id": item["id"], "quantity": 4}],
            "client_request_id": "truck-ok",
        },
        headers=headers,
    )
    assert plan.status_code == 200, plan.text
    assert plan.json()["weight_status"] == "checked"
    assert plan.json()["total_kg"] == 200
    assert plan.json()["stock_moved"] is False
    still = client.get(f"/inventory/stock-levels/item/{item['id']}", headers=headers)
    assert still.json()[0]["quantity"] == 10

    loss = client.post(
        "/inventory/godown-toolkit/losses",
        json={"warehouse_id": warehouse["id"], "item_id": item["id"], "quantity": 2, "reason": "damage"},
        headers=headers,
    )
    assert loss.status_code == 200, loss.text
    assert loss.json()["items"][0]["status"] == "pending"
    still = client.get(f"/inventory/stock-levels/item/{item['id']}", headers=headers)
    assert still.json()[0]["quantity"] == 10
    again = client.post(
        "/inventory/godown-toolkit/losses",
        json={"warehouse_id": warehouse["id"], "item_id": item["id"], "quantity": 1, "reason": "loss"},
        headers=headers,
    )
    assert again.status_code == 409

    gate = client.post(
        "/inventory/godown-toolkit/gate-passes",
        json={
            "document_type": "gate_pass",
            "document_date": "2026-10-29",
            "warehouse_id": warehouse["id"],
            "party_name": "Om Agro Foods",
            "vehicle_no": "RJ 14 GE 3317",
            "lines": [{"item_id": item["id"], "quantity": 3}],
            "client_request_id": "gp-1",
        },
        headers=headers,
    )
    assert gate.status_code == 200, gate.text
    assert gate.json()["document_no"] == "GP-0001"
    assert gate.json()["total_kg"] == 150
    issued = client.patch(
        f"/inventory/godown-toolkit/gate-passes/{gate.json()['id']}/status",
        json={"status": "issued"},
        headers=headers,
    )
    assert issued.status_code == 200, issued.text
    assert issued.json()["stock_moved"] is False
    still = client.get(f"/inventory/stock-levels/item/{item['id']}", headers=headers)
    assert still.json()[0]["quantity"] == 10
    backwards = client.patch(
        f"/inventory/godown-toolkit/gate-passes/{gate.json()['id']}/status",
        json={"status": "draft"},
        headers=headers,
    )
    assert backwards.status_code == 400


def test_labour_quote_and_tenant_isolation(client, register_admin, make_restricted_user):
    admin = register_admin()
    headers = admin["headers"]
    other = register_admin("Other Mills")
    warehouse = _warehouse(client, headers, "GD-3")
    outsider = client.put(
        f"/inventory/godown-toolkit/space/{warehouse['id']}",
        json={"length_ft": 10, "breadth_ft": 10, "aisle_pct": 10},
        headers=other["headers"],
    )
    assert outsider.status_code == 404

    labour = client.post(
        "/inventory/godown-toolkit/labour",
        json={
            "warehouse_id": warehouse["id"],
            "work_date": "2026-10-29",
            "work_type": "loading",
            "basis": "bag",
            "quantity": 10,
            "rate": 6,
            "is_estimate": False,
            "client_request_id": "lab-1",
        },
        headers=headers,
    )
    assert labour.status_code == 200, labour.text
    assert labour.json()["total"] == 60
    assert labour.json()["cost_status"] == "actual"
    repeat = client.post(
        "/inventory/godown-toolkit/labour",
        json={
            "warehouse_id": warehouse["id"],
            "work_date": "2026-10-29",
            "work_type": "loading",
            "basis": "bag",
            "quantity": 10,
            "rate": 6,
            "is_estimate": False,
            "client_request_id": "lab-1",
        },
        headers=headers,
    )
    assert repeat.json()["id"] == labour.json()["id"]

    db = SessionLocal()
    try:
        customer = Customer(tenant_id=admin["user"]["tenant_id"], company_name="Om Agro Foods", status="active")
        db.add(customer)
        db.commit()
        db.refresh(customer)
        customer_id = customer.id
    finally:
        db.close()

    quote = client.post(
        "/inventory/godown-toolkit/quotations",
        json={
            "customer_id": customer_id,
            "warehouse_id": warehouse["id"],
            "quote_date": "2026-10-29",
            "valid_until": "2026-11-03",
            "discount": 0,
            "lines": [{"description": "Wheat storage", "quantity": 100, "rate": 8}],
            "client_request_id": "sq-1",
        },
        headers=headers,
    )
    assert quote.status_code == 200, quote.text
    assert quote.json()["tax_status"] == "not_configured"
    assert quote.json()["tax_amount"] is None
    assert quote.json()["total"] == 800
    hidden = client.get("/inventory/godown-toolkit/quotations", headers=other["headers"])
    assert hidden.json()["total"] == 0

    limited = make_restricted_user(admin["user"]["tenant_id"], ["dashboard"])
    denied = client.get("/inventory/godown-toolkit/dashboard", headers=limited["headers"])
    assert denied.status_code == 403


def test_eoq_requires_explicit_costs(client, register_admin):
    admin = register_admin()
    headers = admin["headers"]
    item = _item(client, headers, "EOQ-1", unit="bag", unit_cost=40)
    missing = client.post(
        "/inventory/godown-toolkit/eoq",
        json={"item_id": item["id"], "order_cost": 100, "holding_pct": 10, "client_request_id": "eoq-1"},
        headers=headers,
    )
    assert missing.status_code == 400
    saved = client.post(
        "/inventory/godown-toolkit/eoq",
        json={
            "item_id": item["id"],
            "annual_demand": 1000,
            "order_cost": 50,
            "holding_pct": 10,
            "client_request_id": "eoq-2",
        },
        headers=headers,
    )
    assert saved.status_code == 200, saved.text
    assert saved.json()["demand_source"] == "entered"
    assert saved.json()["unit_cost_source"] == "item_master"
    assert saved.json()["eoq"] == 158.11
