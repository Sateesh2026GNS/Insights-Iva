"""Per-user alert read state. Operator views ignore Alert.is_read."""

from datetime import datetime, timezone
import importlib.util
from pathlib import Path

from sqlalchemy import create_engine, inspect, text
from alembic.operations import Operations
from alembic.runtime.migration import MigrationContext

from app.core.database import SessionLocal
from app.models.alert import Alert
from tests.test_rbac_roles import _create_role_user


def _headers(login):
    token = login.get("access_token") or login.get("data", {}).get("access_token")
    return {"Authorization": f"Bearer {token}"}


def _migration():
    path = (
        Path(__file__).resolve().parents[1]
        / "alembic"
        / "versions"
        / "b1c2d3e4f5a6_alert_reads.py"
    )
    spec = importlib.util.spec_from_file_location("alert_reads_migration", path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_alert_reads_migration_downgrade_roundtrip():
    migration = _migration()
    engine = create_engine("sqlite://")
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE alerts (id INTEGER PRIMARY KEY)"))
        conn.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY)"))
    with engine.connect() as conn:
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
        conn.commit()
        assert "alert_reads" in inspect(conn).get_table_names()
        with Operations.context(MigrationContext.configure(conn)):
            migration.downgrade()
        conn.commit()
        assert "alert_reads" not in inspect(conn).get_table_names()
        with Operations.context(MigrationContext.configure(conn)):
            migration.upgrade()
        conn.commit()
        assert "alert_reads" in inspect(conn).get_table_names()


def test_operator_read_state_is_per_user(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    first = _create_role_user(client, tenant_id, "Operator")
    second = _create_role_user(client, tenant_id, "Operator")
    db = SessionLocal()
    try:
        alert = Alert(
            tenant_id=tenant_id,
            alert_type="machine",
            title="Shared press alarm",
            severity="medium",
            status="active",
            triggered_at=datetime.now(timezone.utc),
            target_role="Operator",
            created_by="Maintenance",
            is_read=False,
        )
        db.add(alert)
        db.commit()
        alert_id = alert.id
    finally:
        db.close()

    marked = client.put(f"/alerts/{alert_id}/read", headers=_headers(first))
    assert marked.status_code == 200, marked.text
    assert marked.json()["is_read"] is True

    db = SessionLocal()
    try:
        stored = db.get(Alert, alert_id)
        assert stored.is_read is False
    finally:
        db.close()

    mine = client.get("/alerts", headers=_headers(first))
    assert mine.status_code == 200, mine.text
    mine_body = mine.json()
    mine_item = next(item for item in mine_body["items"] if item["id"] == alert_id)
    assert mine_item["is_read"] is True
    theirs = client.get("/alerts", headers=_headers(second))
    assert theirs.status_code == 200, theirs.text
    their_body = theirs.json()
    their_item = next(item for item in their_body["items"] if item["id"] == alert_id)
    assert their_item["is_read"] is False
    assert their_body["unread_count"] == mine_body["unread_count"] + 1

    hidden = client.get(f"/alerts/{alert_id}", headers=_headers(second))
    assert hidden.status_code == 200
    assert hidden.json()["is_read"] is False
