"""Automation Phase 2 — real-time hooks, scheduler gating, summaries."""

from datetime import date
from unittest.mock import MagicMock, patch

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.automation import AutomationExecution, AutomationRule
from app.models.sales import Lead
from app.services.automation.engine import run_scheduled_automations_for_tenant
from app.services.automation.events import AutomationEvent
from app.services.automation.hooks import dispatch_automation_event_isolated
from app.services.automation.scheduler import reset_automation_scheduler_for_tests, start_automation_scheduler
from app.services.automation.seed_rules import ensure_default_automation_rules
from app.services.automation.summary_service import (
    build_daily_automation_summary_for_user,
    count_production_delayed,
    resolve_calendar_week,
)


def test_scheduler_disabled_by_default(monkeypatch):
    monkeypatch.setenv("AUTOMATION_SCHEDULER_ENABLED", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()
    reset_automation_scheduler_for_tests()
    with patch("app.services.automation.scheduler.threading.Thread") as mock_thread:
        start_automation_scheduler()
        mock_thread.assert_not_called()
    get_settings.cache_clear()


def test_scheduler_skips_tick_when_advisory_lock_busy(monkeypatch):
    monkeypatch.setenv("AUTOMATION_SCHEDULER_ENABLED", "true")
    from app.services.automation import scheduler as sched_mod

    with patch.object(sched_mod, "SessionLocal") as mock_session_local:
        db = MagicMock()
        mock_session_local.return_value = db
        with patch(
            "app.services.automation.scheduler_lock.try_acquire_scheduler_lock",
            return_value=False,
        ):
            sched_mod._run_all_tenants()
        db.scalars.assert_not_called()


def test_scheduler_starts_when_enabled(monkeypatch):
    monkeypatch.setenv("AUTOMATION_SCHEDULER_ENABLED", "true")
    from app.core.config import get_settings

    get_settings.cache_clear()
    reset_automation_scheduler_for_tests()
    with patch("app.services.automation.scheduler.threading.Thread") as mock_thread:
        mock_thread.return_value.start = lambda: None
        start_automation_scheduler()
        mock_thread.assert_called_once()
    get_settings.cache_clear()
    reset_automation_scheduler_for_tests()


@patch("app.services.automation.checks.sync_low_stock_alerts")
def test_realtime_and_scheduled_stock_idempotent(mock_sync, register_admin):
    mock_sync.return_value = []
    tenant_id = register_admin()["user"]["tenant_id"]
    dispatch_automation_event_isolated(tenant_id, AutomationEvent.STOCK_LOW)
    db = SessionLocal()
    try:
        ensure_default_automation_rules(db, tenant_id)
        db.commit()
        run_scheduled_automations_for_tenant(db, tenant_id)
        successes = list(
            db.scalars(
                select(AutomationExecution).where(
                    AutomationExecution.tenant_id == tenant_id,
                    AutomationExecution.event_type == AutomationEvent.STOCK_LOW,
                    AutomationExecution.status == "success",
                )
            ).all()
        )
        skipped = list(
            db.scalars(
                select(AutomationExecution).where(
                    AutomationExecution.tenant_id == tenant_id,
                    AutomationExecution.event_type == AutomationEvent.STOCK_LOW,
                    AutomationExecution.status == "skipped",
                )
            ).all()
        )
        assert len(successes) >= 1
        assert len(successes) + len(skipped) >= 1
    finally:
        db.close()


def test_lead_create_dispatches_event(register_admin):
    from app.schemas.sales import LeadCreate  # noqa: PLC0415
    from app.services.sales_service import create_lead

    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        with patch(
            "app.services.automation.hooks.dispatch_automation_event_isolated"
        ) as mock_dispatch:
            create_lead(
                db,
                LeadCreate(
                    tenant_id=tenant_id,
                    name="Phase2 Lead",
                    company="Co",
                    status="new",
                ),
            )
            mock_dispatch.assert_called()
            assert mock_dispatch.call_args[0][1] == AutomationEvent.LEAD_CREATED
    finally:
        db.close()


def test_business_succeeds_when_automation_dispatch_fails(register_admin):
    from app.schemas.sales import LeadCreate  # noqa: PLC0415
    from app.services.sales_service import create_lead

    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        with patch(
            "app.services.automation.hooks.dispatch_automation_event_isolated",
            side_effect=RuntimeError("down"),
        ):
            lead = create_lead(
                db,
                LeadCreate(
                    tenant_id=tenant_id,
                    name="Still Created",
                    company="Co",
                    status="new",
                ),
            )
        assert lead.id
        row = db.get(Lead, lead.id)
        assert row is not None
    finally:
        db.close()


def test_daily_summary_role_filtered(register_admin, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    limited = make_restricted_user(tenant_id, ["sales:read"])
    db = SessionLocal()
    try:
        from app.models.user import User

        user = db.scalars(select(User).where(User.email == limited["email"])).first()
        scoped = build_daily_automation_summary_for_user(db, user)
        assert "sales" in scoped
        assert scoped.get("accounts") is None
    finally:
        db.close()


def test_resolve_calendar_week_monday_sunday():
    mon, sun = resolve_calendar_week(date(2026, 9, 24))  # Wednesday
    assert mon.isoformat() == "2026-09-21"
    assert sun.isoformat() == "2026-09-27"


def test_count_production_delayed_past_due_only():
    from datetime import datetime, timedelta, timezone
    from unittest.mock import MagicMock

    past = datetime.now(timezone.utc) - timedelta(days=1)
    future = datetime.now(timezone.utc) + timedelta(days=1)
    po_past = MagicMock(due_date=past, status="in_progress")
    po_future = MagicMock(due_date=future, status="in_progress")
    db = MagicMock()
    db.scalars.return_value.all.return_value = [po_past, po_future]
    assert count_production_delayed(db, 1) == 1
