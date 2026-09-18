"""Operator My Production Entry — API authorization, validation, submission."""

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.production import ProductionEntry, WorkOrder

from tests.test_rbac_roles import (
    _assign_work_order_to_operator,
    _create_role_user,
    _ensure_tenant_resources,
)


def _work_order_id(tenant_id):
    db = SessionLocal()
    try:
        wo = db.scalars(
            select(WorkOrder).where(
                WorkOrder.tenant_id == tenant_id,
                WorkOrder.work_order_number == "WO-OPERATOR-001",
            )
        ).first()
        assert wo
        return wo.id, float(wo.planned_quantity or 0), float(wo.actual_quantity or 0)
    finally:
        db.close()


def test_operator_my_work_orders_lists_assigned_only(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    headers = {"Authorization": f"Bearer {operator['access_token']}"}

    res = client.get("/api/work-orders/my", headers=headers)
    assert res.status_code == 200
    items = res.json()["items"]
    assert any(i["work_order_number"] == "WO-OPERATOR-001" for i in items)


def test_operator_cannot_view_unassigned_work_order_detail(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    op_a = _create_role_user(client, tenant_id, "Operator")
    op_b = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, op_a["user"]["id"])
    wo_id, _, _ = _work_order_id(tenant_id)

    res = client.get(
        f"/api/work-orders/my/{wo_id}",
        headers={"Authorization": f"Bearer {op_b['access_token']}"},
    )
    assert res.status_code == 403


def test_production_entry_reject_reason_required(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    wo_id, _, _ = _work_order_id(tenant_id)
    headers = {"Authorization": f"Bearer {operator['access_token']}"}

    res = client.post(
        "/api/production-entries",
        headers=headers,
        json={
            "work_order_id": wo_id,
            "quantity_produced": 0,
            "quantity_rejected": 5,
            "reject_reason": "   ",
        },
    )
    assert res.status_code == 422


def test_production_entry_negative_quantity_rejected(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    wo_id, _, _ = _work_order_id(tenant_id)
    headers = {"Authorization": f"Bearer {operator['access_token']}"}

    res = client.post(
        "/api/production-entries",
        headers=headers,
        json={
            "work_order_id": wo_id,
            "quantity_produced": -1,
            "quantity_rejected": 0,
        },
    )
    assert res.status_code == 422


def test_production_entry_exceeds_remaining(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    wo_id, planned, actual = _work_order_id(tenant_id)
    headers = {"Authorization": f"Bearer {operator['access_token']}"}
    remaining = planned - actual

    res = client.post(
        "/api/production-entries",
        headers=headers,
        json={
            "work_order_id": wo_id,
            "quantity_produced": remaining + 100,
            "quantity_rejected": 0,
        },
    )
    assert res.status_code == 400
    body = res.json()
    detail = body.get("message") or body.get("detail") or str(body)
    assert "remaining" in detail.lower()


def test_production_entry_success_and_today_list(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    wo_id, _, _ = _work_order_id(tenant_id)
    headers = {"Authorization": f"Bearer {operator['access_token']}"}

    res = client.post(
        "/api/production-entries",
        headers=headers,
        json={
            "work_order_id": wo_id,
            "quantity_produced": 10,
            "quantity_rejected": 0,
        },
    )
    assert res.status_code == 200
    body = res.json()
    assert body["quantity_produced"] == 10
    assert body["work_order_id"] == wo_id

    listed = client.get("/api/production-entries/my", headers=headers)
    assert listed.status_code == 200
    ids = [e["id"] for e in listed.json()["items"]]
    assert body["id"] in ids


def test_production_entry_duplicate_window(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    wo_id, _, _ = _work_order_id(tenant_id)
    headers = {"Authorization": f"Bearer {operator['access_token']}"}
    payload = {
        "work_order_id": wo_id,
        "quantity_produced": 3,
        "quantity_rejected": 0,
    }

    first = client.post("/api/production-entries", headers=headers, json=payload)
    assert first.status_code == 200
    second = client.post("/api/production-entries", headers=headers, json=payload)
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]

    db = SessionLocal()
    try:
        count = db.scalars(
            select(ProductionEntry).where(
                ProductionEntry.tenant_id == tenant_id,
                ProductionEntry.work_order_id == wo_id,
                ProductionEntry.operator_user_id == operator["user"]["id"],
                ProductionEntry.quantity_produced == 3.0,
            )
        ).all()
        assert len(count) == 1
    finally:
        db.close()


def test_unassigned_operator_cannot_post_entry(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    _, machine_id, order_id = _ensure_tenant_resources(tenant_id)
    db = SessionLocal()
    try:
        wo = WorkOrder(
            tenant_id=tenant_id,
            production_order_id=order_id,
            machine_id=machine_id,
            assigned_user_id=admin["user"]["id"],
            plant_code="plant-1",
            work_order_number="WO-UNASSIGNED-TEST",
            planned_quantity=100,
            status="in_progress",
        )
        db.add(wo)
        db.commit()
        wo_id = wo.id
    finally:
        db.close()
    operator = _create_role_user(client, tenant_id, "Operator")
    headers = {"Authorization": f"Bearer {operator['access_token']}"}

    res = client.post(
        "/api/production-entries",
        headers=headers,
        json={
            "work_order_id": wo_id,
            "quantity_produced": 1,
            "quantity_rejected": 0,
        },
    )
    assert res.status_code == 403
