"""CRUD tests for /api/production/toolkit/issues."""

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.manufacturing_toolkit import ManufacturingIssue
from app.models.security import AccessLog
from app.models.tenant import Tenant


def _data(resp_json):
    body = resp_json
    if "data" in body and body["data"] is not None:
        return body["data"]
    return body


def test_issues_list_requires_auth(client):
    res = client.get("/api/production/toolkit/issues")
    assert res.status_code in (401, 403)


def test_issues_operator_forbidden(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get("/api/production/toolkit/issues", headers=op["headers"])
    assert res.status_code == 403


def test_issue_create_list_get_update_flow(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={
            "title": "Hydraulic leak press-02",
            "department": "Maintenance",
            "priority": "high",
            "owner_name": "S. Patel",
        },
    )
    assert create.status_code == 201, create.text
    row = _data(create.json())
    assert row["status"] == "open"
    assert row["issue_code"].startswith("ISS-")
    issue_id = row["id"]

    listed = client.get(
        "/api/production/toolkit/issues",
        headers=h,
        params={"search": "Hydraulic", "priority": "high"},
    )
    assert listed.status_code == 200
    payload = _data(listed.json())
    assert payload["total"] >= 1
    assert any(i["id"] == issue_id for i in payload["items"])

    got = client.get(f"/api/production/toolkit/issues/{issue_id}", headers=h)
    assert got.status_code == 200

    patched = client.patch(
        f"/api/production/toolkit/issues/{issue_id}",
        headers=h,
        json={"title": "Hydraulic leak press-02 (updated)"},
    )
    assert patched.status_code == 200
    assert _data(patched.json())["title"].endswith("(updated)")

    assigned = client.post(
        f"/api/production/toolkit/issues/{issue_id}/assign",
        headers=h,
        json={"owner_name": "R. Kumar"},
    )
    assert assigned.status_code == 200
    assert _data(assigned.json())["owner_name"] == "R. Kumar"


def test_issue_close_requires_resolution(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"title": "Close me", "priority": "medium"},
    )
    issue_id = _data(create.json())["id"]

    bad = client.post(
        f"/api/production/toolkit/issues/{issue_id}/status",
        headers=h,
        json={"status": "closed"},
    )
    assert bad.status_code == 400

    ok = client.post(
        f"/api/production/toolkit/issues/{issue_id}/status",
        headers=h,
        json={"status": "in_progress"},
    )
    assert ok.status_code == 200

    closed = client.post(
        f"/api/production/toolkit/issues/{issue_id}/status",
        headers=h,
        json={"status": "closed", "resolution_notes": "Replaced seal"},
    )
    assert closed.status_code == 200
    body = _data(closed.json())
    assert body["status"] == "closed"
    assert body["closed_at"] is not None


def test_issue_invalid_transition(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"title": "Transition test", "priority": "low"},
    )
    issue_id = _data(create.json())["id"]
    res = client.post(
        f"/api/production/toolkit/issues/{issue_id}/status",
        headers=h,
        json={"status": "cancelled"},
    )
    assert res.status_code == 200
    res2 = client.post(
        f"/api/production/toolkit/issues/{issue_id}/status",
        headers=h,
        json={"status": "in_progress"},
    )
    assert res2.status_code == 400


def test_issue_duplicate_code(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    code = f"ISS-DUP-{uuid.uuid4().hex[:6]}"
    first = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"issue_code": code, "title": "First"},
    )
    assert first.status_code == 201
    second = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"issue_code": code, "title": "Second"},
    )
    assert second.status_code == 409


def test_issue_tenant_isolation(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"title": "Tenant A issue"},
    )
    issue_id = _data(create.json())["id"]

    db = SessionLocal()
    try:
        slug = f"iso-{uuid.uuid4().hex[:8]}"
        tenant_b = Tenant(name=f"Iso {slug}", slug=slug)
        db.add(tenant_b)
        db.flush()
        other = ManufacturingIssue(
            tenant_id=tenant_b.id,
            issue_code="ISS-OTHER",
            title="Hidden",
            raised_date=date.today(),
            status="open",
            priority="low",
        )
        db.add(other)
        db.commit()
        other_id = other.id
    finally:
        db.close()

    assert client.get(f"/api/production/toolkit/issues/{other_id}", headers=h).status_code == 404

    listed = _data(client.get("/api/production/toolkit/issues", headers=h).json())
    assert all(i["id"] != other_id for i in listed["items"])
    assert any(i["id"] == issue_id for i in listed["items"])


def test_issue_create_writes_audit(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"title": "Audited issue"},
    )
    issue_id = _data(create.json())["id"]
    db = SessionLocal()
    try:
        row = db.scalars(
            select(AccessLog).where(
                AccessLog.resource == "manufacturing_issue",
                AccessLog.resource_id == issue_id,
            )
        ).first()
        assert row is not None
        assert row.action == "create"
    finally:
        db.close()


def test_dashboard_kpi_avg_resolution_after_close(client, register_admin):
    auth = register_admin()
    h = auth["headers"]
    create = client.post(
        "/api/production/toolkit/issues",
        headers=h,
        json={"title": "KPI issue", "priority": "medium"},
    )
    issue_id = _data(create.json())["id"]
    client.post(
        f"/api/production/toolkit/issues/{issue_id}/status",
        headers=h,
        json={"status": "closed", "resolution_notes": "Done"},
    )

    db = SessionLocal()
    try:
        iss = db.get(ManufacturingIssue, issue_id)
        iss.raised_date = date.today() - timedelta(days=5)
        iss.closed_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()

    dash = client.get(
        "/api/production/toolkit/dashboard",
        headers=h,
        params={"toolkit_id": "issue_log"},
    )
    data = _data(dash.json())
    avg = next(k for k in data["kpis"] if k["label"] == "Avg Resolution")
    assert avg["value"] not in (None, "—")
