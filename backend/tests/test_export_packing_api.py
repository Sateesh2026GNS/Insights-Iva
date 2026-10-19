from datetime import date
from uuid import uuid4

from app.core.database import SessionLocal
from app.models.sales import Customer, DispatchShipment, SalesOrder


def _headers(admin):
    return admin["headers"]


def test_dashboard_empty_without_auto_seed(client, register_admin):
    admin = register_admin()
    res = client.get("/api/export/packing-lists/dashboard", headers=_headers(admin))
    assert res.status_code == 200
    body = res.json()
    assert body["packing_list"] is None
    assert body["cartons"] == []
    assert body["recent_packing_lists"] == []


def test_dashboard_repeated_requests_do_not_seed_demo(client, register_admin):
    admin = register_admin()
    headers = _headers(admin)
    for _ in range(3):
        res = client.get("/api/export/packing-lists/dashboard", headers=headers)
        assert res.status_code == 200
        assert res.json()["packing_list"] is None

    count_res = client.get(
        "/api/export/packing-lists/dashboard",
        headers=headers,
        params={"seed_demo": True},
    )
    assert count_res.status_code == 200
    pl_no = count_res.json()["packing_list"]["packing_list_no"]
    assert pl_no == "PL-2025-0428"

    again = client.get("/api/export/packing-lists/dashboard", headers=headers)
    assert again.json()["packing_list"]["packing_list_no"] == pl_no
    assert len(again.json()["recent_packing_lists"]) == 1


def test_export_packing_dashboard_seed_demo_returns_kpis(client, register_admin):
    admin = register_admin()
    headers = _headers(admin)

    res = client.get(
        "/api/export/packing-lists/dashboard",
        headers=headers,
        params={"seed_demo": True},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["packing_list"]["shipment_no"] == "EXP-2025-0428"
    assert body["kpis"]["total_packages"] == 120
    assert len(body["cartons"]) >= 1
    assert body["weight_summary"]

    validate = client.post(
        f"/api/export/packing-lists/{body['packing_list']['id']}/validate",
        headers=headers,
    )
    assert validate.status_code == 200
    assert "ok" in validate.json()


def test_update_packing_list_and_add_carton(client, register_admin):
    admin = register_admin()
    headers = _headers(admin)
    dash = client.get(
        "/api/export/packing-lists/dashboard",
        headers=headers,
        params={"seed_demo": True},
    ).json()
    pl_id = dash["packing_list"]["id"]

    patch = client.patch(
        f"/api/export/packing-lists/{pl_id}",
        headers=headers,
        json={"destination": "Hamburg, Germany"},
    )
    assert patch.status_code == 200
    assert patch.json()["packing_list"]["destination"] == "Hamburg, Germany"

    add = client.post(
        f"/api/export/packing-lists/{pl_id}/cartons",
        headers=headers,
        json={
            "carton_no": "C-TEST",
            "sku_code": "TST-1",
            "item_description": "Test export item",
            "qty_pcs": 10,
        },
    )
    assert add.status_code == 201


def test_carton_update_and_delete(client, register_admin):
    admin = register_admin()
    headers = _headers(admin)
    pl_id = client.post(
        "/api/export/packing-lists",
        headers=headers,
        json={
            "packing_list_no": f"PL-CRUD-{uuid4().hex[:6]}",
            "shipment_no": "EXP-CRUD",
            "cartons_planned": 2,
        },
    ).json()["id"]

    created = client.post(
        f"/api/export/packing-lists/{pl_id}/cartons",
        headers=headers,
        json={
            "carton_no": "C-1",
            "item_description": "Widget",
            "qty_pcs": 5,
        },
    )
    carton_id = created.json()["id"]

    updated = client.patch(
        f"/api/export/packing-lists/cartons/{carton_id}",
        headers=headers,
        json={"qty_pcs": 9, "item_description": "Widget revised"},
    )
    assert updated.status_code == 200
    cartons = updated.json()["cartons"]
    assert any(c["id"] == carton_id and c["qty_pcs"] == 9 for c in cartons)

    deleted = client.delete(
        f"/api/export/packing-lists/cartons/{carton_id}",
        headers=headers,
    )
    assert deleted.status_code == 204

    dash = client.get(
        "/api/export/packing-lists/dashboard",
        headers=headers,
        params={"packing_list_id": pl_id},
    ).json()
    assert dash["cartons"] == []


def test_document_checklist_persists(client, register_admin):
    admin = register_admin()
    headers = _headers(admin)
    pl_id = client.post(
        "/api/export/packing-lists",
        headers=headers,
        json={
            "packing_list_no": f"PL-CHK-{uuid4().hex[:6]}",
            "shipment_no": "EXP-CHK",
        },
    ).json()["id"]

    checklist = [
        {"id": "commercial_invoice", "label": "Commercial invoice verified", "checked": True},
        {"id": "seal_recorded", "label": "Seal recorded", "checked": False},
    ]
    client.patch(
        f"/api/export/packing-lists/{pl_id}",
        headers=headers,
        json={"document_checklist": checklist},
    )

    dash = client.get(
        "/api/export/packing-lists/dashboard",
        headers=headers,
        params={"packing_list_id": pl_id},
    ).json()
    saved = dash["document_checklist"]
    assert saved[0]["checked"] is True
    assert saved[1]["checked"] is False


def test_create_from_dispatch_idempotent(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    headers = _headers(admin)
    suffix = uuid4().hex[:8]
    db = SessionLocal()
    try:
        customer = Customer(
            tenant_id=tenant_id,
            name=f"Packing Dispatch {suffix}",
            status="active",
        )
        db.add(customer)
        db.flush()
        order = SalesOrder(
            tenant_id=tenant_id,
            customer_id=customer.id,
            order_number=f"SO-PK-{suffix}",
            order_date=date.today(),
            status="confirmed",
            packed=True,
        )
        db.add(order)
        db.flush()
        dispatch = DispatchShipment(
            tenant_id=tenant_id,
            dispatch_number=f"DC-PK-{suffix}",
            sales_order_id=order.id,
            customer_id=customer.id,
            dispatch_date=date.today(),
            status="packed",
            box_count=12,
            total_weight=500.5,
            notes="Handle with care",
        )
        db.add(dispatch)
        db.commit()
        dispatch_id = dispatch.id
    finally:
        db.close()

    first = client.post(
        f"/api/export/packing-lists/from-dispatch/{dispatch_id}",
        headers=headers,
    )
    assert first.status_code == 201
    pl_a = first.json()["packing_list"]
    assert pl_a["shipment_no"] == f"DC-PK-{suffix}"
    assert pl_a["dispatch_shipment_id"] == dispatch_id
    assert pl_a["cartons_planned"] == 12

    second = client.post(
        f"/api/export/packing-lists/from-dispatch/{dispatch_id}",
        headers=headers,
    )
    assert second.status_code == 201
    pl_b = second.json()["packing_list"]
    assert pl_b["id"] == pl_a["id"]

    recent = client.get("/api/export/packing-lists/dashboard", headers=headers).json()
    assert len(recent["recent_packing_lists"]) == 1


def test_packing_list_tenant_isolation(client, register_admin):
    auth_a = register_admin()
    auth_b = register_admin()
    headers_a = _headers(auth_a)

    pl_id = client.post(
        "/api/export/packing-lists",
        headers=headers_a,
        json={
            "packing_list_no": f"PL-ISO-{uuid4().hex[:6]}",
            "shipment_no": "EXP-ISO",
        },
    ).json()["id"]

    forbidden = client.get(
        "/api/export/packing-lists/dashboard",
        headers=_headers(auth_b),
        params={"packing_list_id": pl_id},
    )
    assert forbidden.status_code == 404

    patch_b = client.patch(
        f"/api/export/packing-lists/{pl_id}",
        headers=_headers(auth_b),
        json={"destination": "Other tenant"},
    )
    assert patch_b.status_code == 404
