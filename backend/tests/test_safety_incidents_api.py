"""Safety incidents RBAC, workflow, and KPI tests."""

import uuid
from datetime import date

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.hr import SafetyIncident
from app.models.security import AccessLog
from app.services.safety_incident_service import aggregate_incident_metrics


def _data(resp_json):
    body = resp_json
    if "data" in body and body["data"] is not None:
        return body["data"]
    return body


def test_safety_incidents_list_requires_auth(client):
    res = client.get("/api/production/toolkit/safety-incidents")
    assert res.status_code in (401, 403)


def test_safety_incidents_operator_forbidden(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/production/toolkit/safety-incidents", headers=op["headers"])
    assert res.status_code == 403


def test_incident_create_assign_close_audit(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/safety-incidents",
        headers=h,
        json={
            "title": "Slip near loading bay",
            "type": "Near Miss",
            "department": "Logistics",
            "severity": "medium",
            "description": "Wet floor, no injury",
        },
    )
    assert create.status_code == 201, create.text
    row = _data(create.json())
    assert row["status"] == "open"
    assert row["incident_code"].startswith("INC-")
    incident_id = row["id"]
    assert row["reported_by_user_id"] is not None

    assigned = client.post(
        f"/api/production/toolkit/safety-incidents/{incident_id}/assign",
        headers=h,
        json={"investigation_owner_name": "A. Safety"},
    )
    assert assigned.status_code == 200
    assert _data(assigned.json())["status"] == "under_investigation"

    inv = client.post(
        f"/api/production/toolkit/safety-incidents/{incident_id}/investigation",
        headers=h,
        json={
            "investigation_findings": "Housekeeping gap",
            "corrective_action": "Add floor mats",
            "corrective_action_status": "pending",
        },
    )
    assert inv.status_code == 200

    bad_close = client.post(
        f"/api/production/toolkit/safety-incidents/{incident_id}/status",
        headers=h,
        json={"status": "closed"},
    )
    assert bad_close.status_code == 400

    closed = client.post(
        f"/api/production/toolkit/safety-incidents/{incident_id}/status",
        headers=h,
        json={
            "status": "closed",
            "closure_evidence": "Mats installed; area inspected",
        },
    )
    assert closed.status_code == 200
    assert _data(closed.json())["closed_at"] is not None

    db = SessionLocal()
    try:
        logs = list(
            db.scalars(
                select(AccessLog).where(
                    AccessLog.tenant_id == auth["user"]["tenant_id"],
                    AccessLog.resource == "safety_incident",
                    AccessLog.resource_id == incident_id,
                )
            ).all()
        )
        assert len(logs) >= 3
    finally:
        db.close()


def test_incident_tenant_isolation(client, register_admin):
    auth_a = register_admin()
    auth_b = register_admin()
    h_a = auth_a["headers"]
    create = client.post(
        "/api/production/toolkit/safety-incidents",
        headers=h_a,
        json={"title": "Tenant A only", "severity": "low"},
    )
    incident_id = _data(create.json())["id"]

    cross = client.get(
        f"/api/production/toolkit/safety-incidents/{incident_id}",
        headers=auth_b["headers"],
    )
    assert cross.status_code == 404


def test_incident_individual_access_denied(client, register_admin):
    from app.services.auth_service import hash_password
    from app.models.role import Role
    from app.models.user import User, user_roles

    admin = register_admin()
    h_admin = admin["headers"]
    create = client.post(
        "/api/production/toolkit/safety-incidents",
        headers=h_admin,
        json={"title": "Admin incident", "severity": "low"},
    )
    incident_id = _data(create.json())["id"]

    email = f"prod-read-{uuid.uuid4().hex[:8]}@test.local"
    password = "Passw0rd!123"
    db = SessionLocal()
    try:
        role = Role(
            tenant_id=admin["user"]["tenant_id"],
            name="Production Viewer",
            description="read-only production",
            permissions=["production"],
        )
        db.add(role)
        db.flush()
        user = User(
            tenant_id=admin["user"]["tenant_id"],
            email=email,
            full_name="Prod Viewer",
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

    login = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": "Production Viewer"},
    )
    assert login.status_code == 200
    headers = {"Authorization": f"Bearer {login.json()['access_token']}"}
    res = client.get(
        f"/api/production/toolkit/safety-incidents/{incident_id}",
        headers=headers,
    )
    assert res.status_code == 403


def test_incident_list_date_filter_empty(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    res = client.get(
        "/api/production/toolkit/safety-incidents",
        headers=h,
        params={"date_from": "2099-01-01", "date_to": "2099-12-31"},
    )
    assert res.status_code == 200
    payload = _data(res.json())
    assert payload["total"] == 0
    assert payload["items"] == []


def test_incident_kpi_aggregate_consistency():
    rows = [
        SafetyIncident(
            tenant_id=1,
            incident_code="X1",
            title="t",
            type="Near Miss",
            severity="high",
            status="open",
            corrective_action_status="completed",
        ),
        SafetyIncident(
            tenant_id=1,
            incident_code="X2",
            title="t2",
            type="lost time",
            severity="low",
            status="closed",
            corrective_action="fix",
            corrective_action_status="pending",
        ),
    ]
    m = aggregate_incident_metrics(rows)
    assert m["total"] == 2
    assert m["near_miss"] == 1
    assert m["lost_time"] == 1
    assert m["high_severity"] == 1
    assert m["capa_kpi_available"] is True
    assert m["capa_completed"] == 1
    assert m["capa_pending"] == 1


def test_incident_dashboard_kpi(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    client.post(
        "/api/production/toolkit/safety-incidents",
        headers=h,
        json={"title": "Dash test", "type": "Near Miss", "severity": "high"},
    )
    dash = client.get(
        "/api/production/toolkit/dashboard",
        headers=h,
        params={"toolkit_id": "incident_report"},
    )
    assert dash.status_code == 200
    kpis = _data(dash.json()).get("kpis") or []
    labels = {k["label"] for k in kpis}
    assert "Total Incidents" in labels
    capa = next(k for k in kpis if k.get("key") == "capa" or k.get("label") == "Corrective Actions")
    assert capa.get("value") is None or capa.get("value") != ""


def _login_custom_user(client, tenant_id, role_name, permissions, *, full_name="Custom User", employee_id=None):
    from app.services.auth_service import hash_password
    from app.models.role import Role
    from app.models.user import User, user_roles

    email = f"u-{uuid.uuid4().hex[:8]}@test.local"
    password = "Passw0rd!123"
    db = SessionLocal()
    try:
        role = Role(
            tenant_id=tenant_id,
            name=role_name,
            description="test role",
            permissions=list(permissions),
        )
        db.add(role)
        db.flush()
        user = User(
            tenant_id=tenant_id,
            email=email,
            full_name=full_name,
            employee_id=employee_id,
            hashed_password=hash_password(password),
            is_active=True,
            email_verified=True,
        )
        db.add(user)
        db.flush()
        db.execute(user_roles.insert().values(user_id=user.id, role_id=role.id))
        db.commit()
        user_id = user.id
    finally:
        db.close()
    login = client.post(
        "/auth/login",
        json={"email": email, "password": password, "role": role_name},
    )
    assert login.status_code == 200
    return {"headers": {"Authorization": f"Bearer {login.json()['access_token']}"}, "user_id": user_id, "email": email}


def test_incident_dashboard_kpis_match_list_scope_for_reporter(client, register_admin):
    admin = register_admin()
    reporter = _login_custom_user(
        client,
        admin["user"]["tenant_id"],
        "Production Reporter",
        ["production", "production:create"],
        full_name="Reporter Dash",
    )
    client.post(
        "/api/production/toolkit/safety-incidents",
        headers=reporter["headers"],
        json={"title": "Reporter dash incident", "severity": "low"},
    )
    client.post(
        "/api/production/toolkit/safety-incidents",
        headers=admin["headers"],
        json={"title": "Admin-only dash incident", "severity": "low"},
    )
    listed = _data(
        client.get("/api/production/toolkit/safety-incidents", headers=reporter["headers"]).json()
    )
    dash = _data(
        client.get(
            "/api/production/toolkit/dashboard",
            headers=reporter["headers"],
            params={"toolkit_id": "incident_report"},
        ).json()
    )
    list_titles = {i["title"] for i in listed["items"]}
    assert "Reporter dash incident" in list_titles
    assert "Admin-only dash incident" not in list_titles
    total_kpi = next(k for k in dash["kpis"] if k.get("key") == "total")
    assert int(total_kpi["value"]) == listed["total"]
    assert listed["total"] == 1


def test_reporter_sees_own_incident_only(client, register_admin):
    admin = register_admin()
    reporter = _login_custom_user(
        client,
        admin["user"]["tenant_id"],
        "Production Reporter",
        ["production", "production:create"],
        full_name="Reporter One",
    )
    other = _login_custom_user(
        client,
        admin["user"]["tenant_id"],
        "Production Reporter",
        ["production", "production:create"],
        full_name="Reporter Two",
    )
    create = client.post(
        "/api/production/toolkit/safety-incidents",
        headers=reporter["headers"],
        json={"title": "My slip", "severity": "low"},
    )
    assert create.status_code == 201
    incident_id = _data(create.json())["id"]

    mine = client.get("/api/production/toolkit/safety-incidents", headers=reporter["headers"])
    assert mine.status_code == 200
    assert any(i["id"] == incident_id for i in _data(mine.json())["items"])

    other_list = client.get("/api/production/toolkit/safety-incidents", headers=other["headers"])
    assert other_list.status_code == 200
    assert not any(i["id"] == incident_id for i in _data(other_list.json())["items"])


def test_reporter_cannot_assign_or_close(client, register_admin):
    admin = register_admin()
    reporter = _login_custom_user(
        client,
        admin["user"]["tenant_id"],
        "Production Reporter",
        ["production", "production:create"],
    )
    create = client.post(
        "/api/production/toolkit/safety-incidents",
        headers=reporter["headers"],
        json={"title": "Reporter incident", "severity": "low"},
    )
    incident_id = _data(create.json())["id"]
    assert (
        client.post(
            f"/api/production/toolkit/safety-incidents/{incident_id}/assign",
            headers=reporter["headers"],
            json={"investigation_owner_name": "X"},
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/api/production/toolkit/safety-incidents/{incident_id}/status",
            headers=reporter["headers"],
            json={"status": "closed", "closure_evidence": "nope"},
        ).status_code
        == 403
    )


def test_supervisor_department_scope(client, register_admin):
    from app.models.hr import Employee

    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        db.add(
            Employee(
                tenant_id=tenant_id,
                employee_code="SUP-001",
                full_name="Supervisor User",
                department="Assembly",
            )
        )
        db.commit()
    finally:
        db.close()

    supervisor = _login_custom_user(
        client,
        tenant_id,
        "Line Supervisor",
        ["production"],
        full_name="Supervisor User",
        employee_id="SUP-001",
    )
    client.post(
        "/api/production/toolkit/safety-incidents",
        headers=admin["headers"],
        json={"title": "Assembly event", "department": "Assembly", "severity": "low"},
    )
    client.post(
        "/api/production/toolkit/safety-incidents",
        headers=admin["headers"],
        json={"title": "Warehouse event", "department": "Warehouse", "severity": "low"},
    )
    listed = client.get("/api/production/toolkit/safety-incidents", headers=supervisor["headers"])
    assert listed.status_code == 200
    titles = {i["title"] for i in _data(listed.json())["items"]}
    assert "Assembly event" in titles
    assert "Warehouse event" not in titles


def test_unauthorized_investigation(client, register_admin):
    admin = register_admin()
    viewer = _login_custom_user(
        client,
        admin["user"]["tenant_id"],
        "Production Viewer",
        ["production"],
    )
    incident_id = _data(
        client.post(
            "/api/production/toolkit/safety-incidents",
            headers=admin["headers"],
            json={"title": "Investigate me", "severity": "low"},
        ).json()
    )["id"]
    assert (
        client.post(
            f"/api/production/toolkit/safety-incidents/{incident_id}/investigation",
            headers=viewer["headers"],
            json={"investigation_findings": "hack"},
        ).status_code
        == 403
    )


def test_hr_incidents_respect_rbac(client, register_admin, make_restricted_user):
    admin = register_admin()
    h = admin["headers"]
    client.post(
        "/api/production/toolkit/safety-incidents",
        headers=h,
        json={"title": "HR visibility", "severity": "low"},
    )
    hr_user = make_restricted_user(admin["user"]["tenant_id"], ["hr", "hr:read", "hr:create", "hr:update"])
    listed = client.get("/hr/incidents", headers=hr_user["headers"])
    assert listed.status_code == 200
    assert len(listed.json()) >= 1

    no_hr = make_restricted_user(admin["user"]["tenant_id"], ["inventory"])
    denied = client.get("/hr/incidents", headers=no_hr["headers"])
    assert denied.status_code == 403

