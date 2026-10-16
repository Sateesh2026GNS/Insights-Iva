"""API tests for GET /api/production/toolkit/dashboard."""

import uuid
from datetime import date

from app.core.database import SessionLocal
from app.models.manufacturing_toolkit import ManufacturingIssue
from app.models.tenant import Tenant


def _data(resp_json):
    body = resp_json
    if "data" in body and isinstance(body["data"], dict):
        return body["data"]
    return body


def test_toolkit_dashboard_requires_auth(client):
    res = client.get("/api/production/toolkit/dashboard", params={"toolkit_id": "issue_log"})
    assert res.status_code in (401, 403)


def test_toolkit_dashboard_invalid_id(client, register_admin):
    auth = register_admin()
    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "not_a_real_toolkit"},
        headers=auth["headers"],
    )
    assert res.status_code == 400


def test_toolkit_dashboard_empty_issue_log(client, register_admin):
    auth = register_admin()
    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "issue_log"},
        headers=auth["headers"],
    )
    assert res.status_code == 200
    data = _data(res.json())
    assert data["toolkit_id"] == "issue_log"
    assert data["data_available"] is False
    assert data["table_rows"] == []


def test_toolkit_dashboard_tenant_isolation(client, register_admin):
    auth = register_admin()
    tenant_a = auth["user"]["tenant_id"]

    db = SessionLocal()
    try:
        slug = f"iso-{uuid.uuid4().hex[:8]}"
        tenant_b = Tenant(name=f"Other Co {slug}", slug=slug)
        db.add(tenant_b)
        db.flush()
        db.add(
            ManufacturingIssue(
                tenant_id=tenant_b.id,
                issue_code="ISS-ISO",
                title="Hidden issue",
                raised_date=date.today(),
                status="open",
                priority="high",
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "issue_log"},
        headers=auth["headers"],
    )
    data = _data(res.json())
    assert all(r.get("id") != "ISS-ISO" for r in data.get("table_rows", []))

    db = SessionLocal()
    try:
        db.add(
            ManufacturingIssue(
                tenant_id=tenant_a,
                issue_code="ISS-VISIBLE",
                title="Visible issue",
                raised_date=date.today(),
                status="open",
                priority="medium",
            )
        )
        db.commit()
    finally:
        db.close()

    res2 = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "issue_log"},
        headers=auth["headers"],
    )
    data2 = _data(res2.json())
    assert any(r.get("id") == "ISS-VISIBLE" for r in data2.get("table_rows", []))
