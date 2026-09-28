from unittest.mock import patch

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.automation import AutomationExecution, AutomationRule
from app.services.automation.engine import run_scheduled_automations_for_tenant
from app.services.automation.execution_log import idempotency_exists, record_execution
from app.services.automation.seed_rules import ensure_default_automation_rules


def _db_session():
    return SessionLocal()


def test_ensure_default_automation_rules_creates_tenant_rules(register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db_session()
    try:
        ensure_default_automation_rules(db, tenant_id)
        db.commit()
        rows = list(
            db.scalars(select(AutomationRule).where(AutomationRule.tenant_id == tenant_id)).all()
        )
        assert len(rows) >= 10
        assert any(r.code == "low_stock_alert" for r in rows)
    finally:
        db.close()


def test_idempotency_prevents_duplicate_keys(register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db_session()
    try:
        rule = AutomationRule(
            tenant_id=tenant_id,
            code="test_rule",
            name="Test",
            event_type="stock.low",
            enabled=True,
        )
        db.add(rule)
        db.flush()
        record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type="stock.low",
            idempotency_key=f"tenant:{tenant_id}:item:5:2026-01-01",
            status="success",
        )
        db.commit()
        assert idempotency_exists(db, tenant_id, f"tenant:{tenant_id}:item:5:2026-01-01")
    finally:
        db.close()


@patch("app.services.automation.checks.sync_low_stock_alerts")
def test_run_scheduled_low_stock_logs_execution(mock_sync, register_admin):
    mock_sync.return_value = []
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db_session()
    try:
        ensure_default_automation_rules(db, tenant_id)
        db.commit()
        totals = run_scheduled_automations_for_tenant(db, tenant_id)
        assert totals.get("low_stock_alert", 0) >= 0
        mock_sync.assert_called()
        execs = list(
            db.scalars(
                select(AutomationExecution).where(AutomationExecution.tenant_id == tenant_id)
            ).all()
        )
        assert len(execs) >= 1
    finally:
        db.close()


def test_tenant_isolation_rules(register_admin):
    tenant_a = register_admin()["user"]["tenant_id"]
    tenant_b = register_admin()["user"]["tenant_id"]
    assert tenant_a != tenant_b
    db = _db_session()
    try:
        ensure_default_automation_rules(db, tenant_a)
        db.commit()
        foreign_rule = db.scalar(
            select(AutomationRule.id).where(
                AutomationRule.tenant_id == tenant_b,
                AutomationRule.code == "low_stock_alert",
            )
        )
        assert foreign_rule is None
        rules_a = list(
            db.scalars(select(AutomationRule).where(AutomationRule.tenant_id == tenant_a)).all()
        )
        assert len(rules_a) >= 10
    finally:
        db.close()


def test_automation_rules_api_admin_only(client, register_admin, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    ok = client.get("/api/automation/rules", headers=admin["headers"])
    assert ok.status_code == 200
    assert len(ok.json()) >= 10

    limited = make_restricted_user(tenant_id, ["sales:read"])
    denied = client.get("/api/automation/rules", headers=limited["headers"])
    assert denied.status_code == 403


@patch("app.services.automation.checks.emit_alert", side_effect=RuntimeError("notify down"))
def test_notification_failure_recorded_without_crashing_rule(mock_emit, register_admin):
    from datetime import date

    from app.models.sales import Lead

    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db_session()
    try:
        ensure_default_automation_rules(db, tenant_id)
        rule = db.scalar(
            select(AutomationRule).where(
                AutomationRule.tenant_id == tenant_id,
                AutomationRule.code == "followup_due",
            )
        )
        assert rule
        lead = Lead(
            tenant_id=tenant_id,
            name="Test Lead",
            company="Co",
            status="new",
            sales_executive="Nobody",
            next_followup=date.today(),
        )
        db.add(lead)
        db.commit()

        totals = run_scheduled_automations_for_tenant(db, tenant_id)
        assert totals.get("followup_due", 0) >= 0
        failed = db.scalar(
            select(AutomationExecution).where(
                AutomationExecution.tenant_id == tenant_id,
                AutomationExecution.status == "failed",
            )
        )
        assert failed is not None
    finally:
        db.close()
