"""CRUD tests for /api/production/toolkit/process-checklist/items."""

import uuid
from datetime import date, timedelta

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.manufacturing_toolkit import ProcessChecklistItem
from app.models.security import AccessLog
from app.models.tenant import Tenant


def _data(resp_json):
    body = resp_json
    if "data" in body and body["data"] is not None:
        return body["data"]
    return body


def test_checklist_operator_forbidden(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/production/toolkit/process-checklist/items", headers=op["headers"])
    assert res.status_code == 403


def test_checklist_create_list_verify_approve(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        json={
            "process_stage": "Production",
            "description": "Line clearance before start",
            "owner_name": "Supervisor",
            "due_date": (date.today() + timedelta(days=2)).isoformat(),
            "frequency": "daily",
        },
    )
    assert create.status_code == 201, create.text
    row = _data(create.json())
    item_id = row["id"]
    assert row["checklist_code"].startswith("CHK-")
    assert row["status"] == "pending"

    listed = client.get(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        params={"process_stage": "Production", "pending_only": True},
    )
    assert listed.status_code == 200
    assert _data(listed.json())["total"] >= 1

    client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/status",
        headers=h,
        json={"status": "in_progress"},
    )
    verified = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/verify",
        headers=h,
        json={"verification_result": "pass"},
    )
    assert verified.status_code == 200
    assert _data(verified.json())["status"] == "completed"

    approved = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/approve",
        headers=h,
        json={"approved": True},
    )
    assert approved.status_code == 200
    assert _data(approved.json())["status"] == "approved"
    assert _data(approved.json())["approved_at"] is not None


def test_checklist_verify_fail_stays_in_progress(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        json={"process_stage": "QC", "description": "Sampling check"},
    )
    item_id = _data(create.json())["id"]
    client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/status",
        headers=h,
        json={"status": "in_progress"},
    )
    res = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/verify",
        headers=h,
        json={"verification_result": "fail"},
    )
    body = _data(res.json())
    assert body["status"] == "in_progress"
    assert body["verification_result"] == "fail"


def test_checklist_overdue_filter(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        json={
            "process_stage": "Raw Material",
            "description": "Overdue item",
            "due_date": (date.today() - timedelta(days=3)).isoformat(),
        },
    )
    code = _data(create.json())["checklist_code"]
    res = client.get(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        params={"overdue_only": True},
    )
    items = _data(res.json())["items"]
    assert any(i["checklist_code"] == code and i["is_overdue"] for i in items)


def test_checklist_duplicate_code(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    code = f"CHK-DUP-{uuid.uuid4().hex[:6]}"
    assert (
        client.post(
            "/api/production/toolkit/process-checklist/items",
            headers=h,
            json={"checklist_code": code, "process_stage": "A", "description": "One"},
        ).status_code
        == 201
    )
    assert (
        client.post(
            "/api/production/toolkit/process-checklist/items",
            headers=h,
            json={"checklist_code": code, "process_stage": "B", "description": "Two"},
        ).status_code
        == 409
    )


def test_checklist_tenant_isolation(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    db = SessionLocal()
    try:
        slug = f"chk-{uuid.uuid4().hex[:8]}"
        tenant_b = Tenant(name=f"Chk {slug}", slug=slug)
        db.add(tenant_b)
        db.flush()
        other = ProcessChecklistItem(
            tenant_id=tenant_b.id,
            checklist_code="CHK-OTHER",
            process_stage="X",
            description="Hidden",
            status="pending",
        )
        db.add(other)
        db.commit()
        other_id = other.id
    finally:
        db.close()
    assert client.get(f"/api/production/toolkit/process-checklist/items/{other_id}", headers=h).status_code == 404


def test_checklist_audit_on_create(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        json={"process_stage": "Dispatch", "description": "Audit trail"},
    )
    item_id = _data(create.json())["id"]
    db = SessionLocal()
    try:
        row = db.scalars(
            select(AccessLog).where(
                AccessLog.resource == "process_checklist_item",
                AccessLog.resource_id == item_id,
            )
        ).first()
        assert row is not None
        assert row.action == "create"
    finally:
        db.close()


def test_checklist_reject_requires_reason(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    item_id = _data(
        client.post(
            "/api/production/toolkit/process-checklist/items",
            headers=h,
            json={"process_stage": "QC", "description": "Reject test"},
        ).json()
    )["id"]
    client.post(f"/api/production/toolkit/process-checklist/items/{item_id}/status", headers=h, json={"status": "in_progress"})
    client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/verify",
        headers=h,
        json={"verification_result": "pass"},
    )
    bad = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/approve",
        headers=h,
        json={"approved": False},
    )
    assert bad.status_code == 400
    ok = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/approve",
        headers=h,
        json={"approved": False, "rejection_reason": "Incomplete evidence"},
    )
    assert ok.status_code == 200
    assert _data(ok.json())["status"] == "pending"


def test_checklist_cannot_approve_without_pass_verification(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    item_id = _data(
        client.post(
            "/api/production/toolkit/process-checklist/items",
            headers=h,
            json={"process_stage": "QC", "description": "No pass"},
        ).json()
    )["id"]
    res = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/approve",
        headers=h,
        json={"approved": True},
    )
    assert res.status_code == 400


def test_checklist_invalid_status_transition(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    item_id = _data(
        client.post(
            "/api/production/toolkit/process-checklist/items",
            headers=h,
            json={"process_stage": "QC", "description": "Bad transition"},
        ).json()
    )["id"]
    res = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/status",
        headers=h,
        json={"status": "approved"},
    )
    assert res.status_code == 400


def test_checklist_non_owner_cannot_verify(client, register_admin):
    import uuid as _uuid
    from app.services.auth_service import hash_password
    from app.models.role import Role
    from app.models.user import User, user_roles

    auth = register_admin()
    h = auth["headers"]
    item_id = _data(
        client.post(
            "/api/production/toolkit/process-checklist/items",
            headers=h,
            json={"process_stage": "QC", "description": "Owner only", "owner_name": "Alice Owner"},
        ).json()
    )["id"]
    email = f"chk-{ _uuid.uuid4().hex[:6]}@test.local"
    password = "Passw0rd!123"
    db = SessionLocal()
    try:
        role = Role(
            tenant_id=auth["user"]["tenant_id"],
            name="Checklist Worker",
            permissions=["production"],
        )
        db.add(role)
        db.flush()
        user = User(
            tenant_id=auth["user"]["tenant_id"],
            email=email,
            full_name="Bob Other",
            hashed_password=hash_password(password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
    finally:
        db.close()
    login = client.post("/auth/login", json={"email": email, "password": password, "role": "Checklist Worker"})
    worker_h = {"Authorization": f"Bearer {login.json()['access_token']}"}
    client.post(f"/api/production/toolkit/process-checklist/items/{item_id}/status", headers=h, json={"status": "in_progress"})
    denied = client.post(
        f"/api/production/toolkit/process-checklist/items/{item_id}/verify",
        headers=worker_h,
        json={"verification_result": "pass"},
    )
    assert denied.status_code == 403


def test_dashboard_kpis_match_records(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    client.post(
        "/api/production/toolkit/process-checklist/items",
        headers=h,
        json={
            "process_stage": "Production",
            "description": "Dash KPI row",
            "due_date": date.today().isoformat(),
        },
    )
    dash = client.get(
        "/api/production/toolkit/dashboard",
        headers=h,
        params={"toolkit_id": "process_checklist"},
    )
    data = _data(dash.json())
    total_kpi = next(k for k in data["kpis"] if k["label"] == "Total Items")
    assert int(total_kpi["value"]) >= 1
