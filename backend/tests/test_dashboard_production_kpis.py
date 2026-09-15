"""Production dashboard KPI aggregation tests."""

from __future__ import annotations

from datetime import date

from app.services.dashboard_production_kpis import (
    get_production_manager_action_required,
    get_production_manager_summary,
    get_production_pipeline_counts,
)


def test_production_pipeline_returns_five_stages(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        counts = get_production_pipeline_counts(db, tenant_id)
    finally:
        db.close()

    assert set(counts.keys()) == {
        "pending",
        "planned",
        "in_production",
        "qc",
        "completed",
    }
    assert all(isinstance(v, int) and v >= 0 for v in counts.values())


def test_production_manager_summary_defaults_to_zero(client, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        summary = get_production_manager_summary(db, tenant_id, date.today())
        actions = get_production_manager_action_required(db, tenant_id, date.today())
    finally:
        db.close()

    assert summary["job_cards_pending"] >= 0
    assert summary["job_cards_in_progress"] >= 0
    assert summary["pending_qc"] >= 0
    assert summary["produced_today"] >= 0
    assert actions["material_waiting"] >= 0
    assert actions["overdue_production"] >= 0


def test_production_hub_includes_summary_and_actions(client, register_admin):
    admin = register_admin()
    login = client.post(
        "/api/auth/login",
        json={"email": admin["email"], "password": admin["password"], "role": "Admin"},
    )
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/production/hub", headers=headers)
    assert resp.status_code == 200
    body = resp.json()
    hub = body.get("data", body)
    assert "production_summary" in hub
    assert "action_required" in hub
    assert "job_cards_pending" in hub["production_summary"]
    assert "material_waiting" in hub["action_required"]


def test_erp_dashboard_pipeline_has_qc_not_released(client, register_admin):
    admin = register_admin()
    login = client.post(
        "/api/auth/login",
        json={"email": admin["email"], "password": admin["password"], "role": "Admin"},
    )
    headers = {"Authorization": f"Bearer {login.json()['data']['access_token']}"}
    resp = client.get("/api/erp/dashboard", headers=headers)
    assert resp.status_code == 200
    pipeline = resp.json()["data"]["production_pipeline"]
    assert "qc" in pipeline
    assert "released" not in pipeline
