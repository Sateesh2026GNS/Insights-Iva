"""Operator security lockdown: catalog 403, scoped alerts and documents, IDOR 404."""

from app.core.database import SessionLocal
from app.models.alert import Alert
from app.models.document import Document
from app.models.machine import Machine
from app.models.production import WorkOrder
from app.models.user import User
from datetime import datetime, timezone

from tests.test_operator_production_entry import _work_order_id
from tests.test_rbac_roles import _assign_work_order_to_operator, _create_role_user


def _headers(login):
    token = login.get("access_token") or login.get("data", {}).get("access_token")
    return {"Authorization": f"Bearer {token}"}


def test_operator_forbidden_on_catalog_other_roles_allowed(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    manager = _create_role_user(client, tenant_id, "Production Manager")
    store = _create_role_user(client, tenant_id, "Store Manager")

    for path in ("/api/products", "/api/bom", "/api/batches"):
        denied = client.get(path, headers=_headers(operator))
        assert denied.status_code == 403, path
        allowed = client.get(path, headers=_headers(manager))
        assert allowed.status_code == 200, path
        store_res = client.get(path, headers=_headers(store))
        if path == "/api/batches":
            assert store_res.status_code in (200, 403)
            assert "Operators cannot" not in store_res.text
        else:
            assert store_res.status_code == 200, path


def test_operator_denied_plant_routes(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    headers = _headers(operator)
    denied = [
        "/api/production/work-orders",
        "/factory-monitor/live-production",
        "/production-scheduling/dashboard",
        "/admin/approvals/queue",
        "/hr/attendance",
        "/hr/attendance/clock-in",
        "/manufacturing/workflow/sales-orders/1/stage/store",
    ]
    for path in denied:
        method = client.post if path.endswith("clock-in") else client.get
        res = method(path, headers=headers)
        assert res.status_code in (403, 404, 405), (path, res.status_code, res.text[:200])
        if path != "/hr/attendance/clock-in":
            assert res.status_code == 403, (path, res.status_code, res.text[:200])

    mine = client.get("/api/work-orders/my", headers=headers)
    assert mine.status_code == 200


def test_operator_alert_category_and_visibility(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    headers = _headers(operator)
    blocked = client.post(
        "/alerts",
        headers=headers,
        json={"title": "Low stock widget", "alert_type": "low_stock"},
    )
    assert blocked.status_code == 403

    created = client.post(
        "/alerts",
        headers=headers,
        json={"title": "Press stopped", "alert_type": "machine", "target_role": "Operator"},
    )
    assert created.status_code == 200, created.text

    db = SessionLocal()
    try:
        db.add(
            Alert(
                tenant_id=tenant_id,
                alert_type="low_stock",
                title="Hidden stock",
                severity="medium",
                status="active",
                triggered_at=datetime.now(timezone.utc),
                target_role="Store Manager",
                created_by="Someone Else",
            )
        )
        db.commit()
    finally:
        db.close()

    listed = client.get("/alerts", headers=headers)
    assert listed.status_code == 200, listed.text
    titles = [item["title"] for item in listed.json()["items"]]
    assert "Press stopped" in titles
    assert "Hidden stock" not in titles


def test_operator_documents_match_own_work_order_only(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    _assign_work_order_to_operator(tenant_id, operator["user"]["id"])
    wo_id, _, _ = _work_order_id(tenant_id)
    db = SessionLocal()
    try:
        wo = db.get(WorkOrder, wo_id)
        wo.assigned_user_id = operator["user"]["id"]
        mine = Document(
            tenant_id=tenant_id,
            doc_type="production",
            title="SOP mine",
            reference_type="work_order",
            reference_id=wo_id,
        )
        other_wo = WorkOrder(
            tenant_id=tenant_id,
            production_order_id=wo.production_order_id,
            work_order_number="WO-OTHER-DOC",
            planned_quantity=1,
            status="planned",
        )
        db.add(other_wo)
        db.flush()
        other = Document(
            tenant_id=tenant_id,
            doc_type="production",
            title="SOP other",
            reference_type="work_order",
            reference_id=other_wo.id,
        )
        db.add_all([mine, other])
        db.commit()
        other_id = other.id
    finally:
        db.close()

    listed = client.get("/documents", headers=_headers(operator))
    assert listed.status_code == 200, listed.text
    titles = [item["title"] for item in listed.json()]
    assert "SOP mine" in titles
    assert "SOP other" not in titles
    hidden = client.get(f"/documents/{other_id}", headers=_headers(operator))
    assert hidden.status_code == 404


def test_operator_machine_and_job_card_idor(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    operator = _create_role_user(client, tenant_id, "Operator")
    db = SessionLocal()
    try:
        mine = Machine(tenant_id=tenant_id, code="OP-MINE", name="Mine", status="idle", is_active=True)
        other = Machine(tenant_id=tenant_id, code="OP-OTHER", name="Other", status="idle", is_active=True)
        db.add_all([mine, other])
        db.flush()
        user = db.get(User, operator["user"]["id"])
        user.assigned_machine_id = mine.id
        db.commit()
        other_id = other.id
    finally:
        db.close()

    res = client.get(f"/api/machines/{other_id}", headers=_headers(operator))
    assert res.status_code == 404

    stage = client.get(
        "/manufacturing/workflow/sales-orders/999999/stage/operator",
        headers=_headers(operator),
    )
    assert stage.status_code == 404
