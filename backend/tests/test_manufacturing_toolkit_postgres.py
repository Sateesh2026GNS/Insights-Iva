"""PostgreSQL integration tests for manufacturing toolkit (run with USE_POSTGRES_TESTS=1).

Requires disposable DATABASE_URL:
  postgresql+psycopg://insights_user:insights_test_only@127.0.0.1:55432/insights_iva_test
"""

import os
import uuid
from datetime import date, timedelta
from urllib.parse import urlparse

import pytest
from sqlalchemy import inspect, text

from app.core.database import SessionLocal, engine
from app.models.manufacturing_toolkit import ManufacturingIssue, ProcessChecklistItem
from app.services.manufacturing_toolkit_service import TOOLKIT_IDS

_DISPOSABLE_PORT = 55432
_DISPOSABLE_DB = "insights_iva_test"


def _assert_disposable_target() -> None:
    url = os.environ.get("DATABASE_URL", "")
    parsed = urlparse(url)
    assert parsed.hostname in ("127.0.0.1", "localhost")
    assert (parsed.port or 5432) == _DISPOSABLE_PORT
    assert (parsed.path or "").lstrip("/") == _DISPOSABLE_DB


def _data(resp_json):
    body = resp_json
    if "data" in body and isinstance(body["data"], dict):
        return body["data"]
    return body


@pytest.fixture(scope="module", autouse=True)
def _require_postgres_disposable():
    if os.environ.get("USE_POSTGRES_TESTS") != "1":
        pytest.skip("USE_POSTGRES_TESTS=1 not set")
    _assert_disposable_target()


def test_manufacturing_toolkit_tables_exist():
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    assert "manufacturing_issues" in tables
    assert "process_checklist_items" in tables


@pytest.mark.parametrize("toolkit_id", sorted(TOOLKIT_IDS))
def test_toolkit_dashboard_all_ids(client, register_admin, toolkit_id):
    auth = register_admin()
    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": toolkit_id},
        headers=auth["headers"],
    )
    assert res.status_code == 200
    data = _data(res.json())
    assert data["toolkit_id"] == toolkit_id
    assert "kpis" in data
    assert isinstance(data.get("table_rows"), list)


def test_toolkit_dashboard_date_filter_excludes_issue(client, register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    old = date.today() - timedelta(days=120)
    db = SessionLocal()
    try:
        db.add(
            ManufacturingIssue(
                tenant_id=tenant_id,
                issue_code=f"ISS-OLD-{uuid.uuid4().hex[:6]}",
                title="Old issue",
                raised_date=old,
                status="open",
                priority="low",
            )
        )
        db.commit()
    finally:
        db.close()

    recent_from = (date.today() - timedelta(days=7)).isoformat()
    res = client.get(
        "/api/production/toolkit/dashboard",
        params={
            "toolkit_id": "issue_log",
            "date_from": recent_from,
            "date_to": date.today().isoformat(),
        },
        headers=auth["headers"],
    )
    data = _data(res.json())
    assert all("Old issue" not in (r.get("title") or "") for r in data.get("table_rows", []))


def test_toolkit_equipment_asset_value_unavailable_kpi(client, register_admin):
    auth = register_admin()
    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "equipment_inventory"},
        headers=auth["headers"],
    )
    data = _data(res.json())
    asset = next((k for k in data["kpis"] if k.get("label") == "Asset Value"), None)
    assert asset is not None
    assert asset.get("value") in ("—", None) or asset.get("value") == "—"


def test_toolkit_dashboard_operator_forbidden(client, register_admin, make_restricted_user):
    admin = register_admin()
    op = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "issue_log"},
        headers=op["headers"],
    )
    assert res.status_code == 403


def test_process_checklist_item_roundtrip_table(client, register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    code = f"CHK-PG-{uuid.uuid4().hex[:6]}"
    db = SessionLocal()
    try:
        db.add(
            ProcessChecklistItem(
                tenant_id=tenant_id,
                checklist_code=code,
                process_stage="Production",
                description="Line clearance",
                owner_name="Supervisor",
                due_date=date.today(),
                status="pending",
                verification_result="pending",
            )
        )
        db.commit()
    finally:
        db.close()

    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "process_checklist"},
        headers=auth["headers"],
    )
    data = _data(res.json())
    assert data["data_available"] is True
    assert any(r.get("id") == code for r in data.get("table_rows", []))


def test_issue_persists_in_postgres(client, register_admin):
    auth = register_admin()
    tenant_id = auth["user"]["tenant_id"]
    code = f"ISS-PG-{uuid.uuid4().hex[:6]}"
    db = SessionLocal()
    try:
        db.add(
            ManufacturingIssue(
                tenant_id=tenant_id,
                issue_code=code,
                title="PG issue",
                raised_date=date.today(),
                status="open",
                priority="high",
            )
        )
        db.commit()
        with engine.connect() as conn:
            n = conn.execute(
                text("SELECT COUNT(*) FROM manufacturing_issues WHERE issue_code = :c"),
                {"c": code},
            ).scalar()
            assert n == 1
    finally:
        db.close()

    res = client.get(
        "/api/production/toolkit/dashboard",
        params={"toolkit_id": "issue_log"},
        headers=auth["headers"],
    )
    data = _data(res.json())
    assert any(r.get("id") == code for r in data.get("table_rows", []))
