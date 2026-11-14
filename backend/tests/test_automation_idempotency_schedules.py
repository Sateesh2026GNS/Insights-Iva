"""Regression: automation idempotency UniqueViolation + Reports Center tick isolation."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.database import SessionLocal
from app.models.automation import AutomationExecution, AutomationRule
from app.models.reporting import ReportSchedule, ReportScheduleExecution
from app.models.user import User
from app.services.automation.checks import _emit_with_idempotency
from app.services.automation.engine import run_scheduled_automations_for_tenant
from app.services.automation.execution_log import (
    get_execution_by_key,
    idempotency_exists,
    record_execution,
)
from app.services.automation.scheduler import _run_all_tenants
from app.services.automation.scheduler_lock import (
    release_scheduler_lock,
    try_acquire_scheduler_lock,
)
from app.services.reports.schedules_service import (
    create_schedule,
    list_executions,
    run_due_schedules,
)
from app.schemas.reports import ReportScheduleCreate


def _db():
    return SessionLocal()


def test_record_execution_repeated_success_does_not_duplicate(register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db()
    try:
        rule = AutomationRule(
            tenant_id=tenant_id,
            code="idem_test",
            name="Idem Test",
            event_type="stock.low",
            enabled=True,
        )
        db.add(rule)
        db.flush()
        key = f"idem_test:entity:1:2026-11-11"
        first = record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="success",
            action_summary="Notification sent",
        )
        db.commit()
        second = record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="skipped",
            action_summary="Already notified",
        )
        db.commit()
        assert second.id == first.id
        count = db.scalar(
            select(func.count()).select_from(AutomationExecution).where(
                AutomationExecution.tenant_id == tenant_id,
                AutomationExecution.idempotency_key == key,
            )
        )
        assert count == 1
        assert idempotency_exists(db, tenant_id, key)
    finally:
        db.close()


def test_record_execution_failed_then_success_updates_same_row(register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db()
    try:
        rule = AutomationRule(
            tenant_id=tenant_id,
            code="retry_test",
            name="Retry Test",
            event_type="production_order.delayed",
            enabled=True,
        )
        db.add(rule)
        db.flush()
        key = "production_delay:production_order:99:2026-07-26"
        failed = record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="failed",
            error_message="notify down",
            retry_count=1,
        )
        db.commit()
        success = record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="success",
            action_summary="Notification sent",
            retry_count=1,
        )
        db.commit()
        assert success.id == failed.id
        row = get_execution_by_key(db, tenant_id, key)
        assert row is not None
        assert row.status == "success"
        assert row.error_message is None
    finally:
        db.close()


def test_emit_with_idempotency_skips_without_inserting_duplicate(register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db()
    try:
        rule = AutomationRule(
            tenant_id=tenant_id,
            code="production_delay",
            name="Production Delay",
            event_type="production_order.delayed",
            enabled=True,
        )
        db.add(rule)
        db.flush()
        key = "production_delay:production_order:2:2026-07-26"
        record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="success",
            action_summary="Notification sent",
            entity_type="production_order",
            entity_id=2,
        )
        db.commit()

        emit_calls = {"n": 0}

        def _emit():
            emit_calls["n"] += 1

        again = _emit_with_idempotency(
            db,
            tenant_id,
            rule,
            idempotency_key=key,
            idempotency_guard=idempotency_exists,
            correlation_id="cid-1",
            entity_type="production_order",
            entity_id=2,
            emit_fn=_emit,
        )
        db.commit()
        assert again is False
        assert emit_calls["n"] == 0
        count = db.scalar(
            select(func.count()).select_from(AutomationExecution).where(
                AutomationExecution.tenant_id == tenant_id,
                AutomationExecution.idempotency_key == key,
            )
        )
        assert count == 1
    finally:
        db.close()


@patch("app.services.automation.checks.sync_low_stock_alerts", return_value=[])
def test_repeated_tenant_ticks_remain_idempotent(mock_sync, register_admin):
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db()
    try:
        run_scheduled_automations_for_tenant(db, tenant_id)
        first_count = db.scalar(
            select(func.count()).select_from(AutomationExecution).where(
                AutomationExecution.tenant_id == tenant_id
            )
        )
        run_scheduled_automations_for_tenant(db, tenant_id)
        second_count = db.scalar(
            select(func.count()).select_from(AutomationExecution).where(
                AutomationExecution.tenant_id == tenant_id
            )
        )
        assert second_count == first_count
        keys = list(
            db.scalars(
                select(AutomationExecution.idempotency_key).where(
                    AutomationExecution.tenant_id == tenant_id
                )
            ).all()
        )
        assert len(keys) == len(set(keys))
    finally:
        db.close()


def test_record_execution_concurrent_insert_uses_integrity_path(register_admin):
    """Simulate a race: lookup misses, insert hits unique constraint, winner returned."""
    tenant_id = register_admin()["user"]["tenant_id"]
    db = _db()
    try:
        rule = AutomationRule(
            tenant_id=tenant_id,
            code="race_test",
            name="Race",
            event_type="stock.critical",
            enabled=True,
        )
        db.add(rule)
        db.flush()
        key = "race_test:sync:2026-11-11"
        winner = record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="success",
        )
        db.commit()

        from sqlalchemy.exc import IntegrityError

        def _raise_integrity(*_a, **_k):
            raise IntegrityError("stmt", {}, Exception("uq_automation_exec_tenant_idempotency"))

        nested = MagicMock()
        nested.__enter__ = MagicMock(side_effect=_raise_integrity)
        nested.__exit__ = MagicMock(return_value=True)

        with patch(
            "app.services.automation.execution_log.get_execution_by_key",
            side_effect=[None, winner],
        ):
            with patch.object(db, "begin_nested", return_value=nested):
                got = record_execution(
                    db,
                    tenant_id=tenant_id,
                    rule=rule,
                    event_type=rule.event_type,
                    idempotency_key=key,
                    status="success",
                )
        assert got.id == winner.id
    finally:
        db.close()


def test_advisory_lock_acquire_and_release_roundtrip():
    db = MagicMock()
    db.execute.return_value.scalar.return_value = True
    with patch("app.services.automation.scheduler_lock.get_settings") as gs:
        gs.return_value.is_sqlite = False
        assert try_acquire_scheduler_lock(db) is True
        release_scheduler_lock(db)
    assert db.execute.call_count == 2
    sqls = [str(c.args[0]) for c in db.execute.call_args_list]
    assert "pg_try_advisory_lock" in sqls[0]
    assert "pg_advisory_unlock" in sqls[1]


def test_advisory_lock_busy_returns_false():
    db = MagicMock()
    db.execute.return_value.scalar.return_value = False
    with patch("app.services.automation.scheduler_lock.get_settings") as gs:
        gs.return_value.is_sqlite = False
        assert try_acquire_scheduler_lock(db) is False


def test_scheduler_still_runs_reports_when_legacy_fails(register_admin):
    register_admin()  # ensure at least one tenant exists
    with patch("app.services.automation.scheduler.SessionLocal") as mock_session_local:
        db = MagicMock()
        mock_session_local.return_value = db
        db.scalars.return_value.all.return_value = [1]
        with patch(
            "app.services.automation.scheduler_lock.try_acquire_scheduler_lock",
            return_value=True,
        ), patch(
            "app.services.automation.scheduler_lock.release_scheduler_lock",
        ) as release, patch(
            "app.services.automation.engine.run_scheduled_automations_for_tenant",
            side_effect=RuntimeError("legacy boom"),
        ), patch(
            "app.services.reports.schedules_service.run_due_schedules",
            return_value=0,
        ) as reports:
            _run_all_tenants()
        reports.assert_called_once_with(db)
        release.assert_called_once_with(db)
        db.rollback.assert_called()


@patch("app.services.reports.export.export_report")
@patch("app.services.email_service.send_email")
@patch("app.services.email_service.smtp_is_configured", return_value=True)
def test_run_due_schedules_records_success_with_mocked_email(
    mock_smtp, mock_send, mock_export, register_admin
):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    mock_export.return_value = {"download_url": "/downloads/test.xlsx"}
    db = _db()
    try:
        due = datetime.now(timezone.utc) - timedelta(minutes=5)
        row = ReportSchedule(
            tenant_id=tenant_id,
            user_id=user_id,
            report_key="inventory_stock",
            name="Due stock report",
            filters_json="{}",
            frequency="daily",
            send_at=time(9, 0),
            timezone="UTC",
            next_run_at=due,
            recipients_json='["noreply@example.com"]',
            format="xlsx",
            is_active=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        ran = run_due_schedules(db)
        assert ran == 1
        mock_send.assert_called_once()
        assert "noreply@example.com" in mock_send.call_args.args[0]
        execs = list(
            db.scalars(
                select(ReportScheduleExecution).where(
                    ReportScheduleExecution.schedule_id == row.id,
                    ReportScheduleExecution.tenant_id == tenant_id,
                )
            ).all()
        )
        assert len(execs) == 1
        assert execs[0].status == "success"
        assert execs[0].triggered_by == "scheduler"
        db.refresh(row)
        assert row.last_status == "success"
        assert row.retry_count == 0
        assert row.next_run_at is not None
        nxt = row.next_run_at
        if nxt.tzinfo is None:
            nxt = nxt.replace(tzinfo=timezone.utc)
        assert nxt > due
    finally:
        db.close()


@patch("app.services.reports.export.export_report", side_effect=RuntimeError("export failed"))
@patch("app.services.email_service.send_email")
def test_run_due_schedules_records_failure_and_retries(mock_send, mock_export, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    db = _db()
    try:
        due = datetime.now(timezone.utc) - timedelta(minutes=5)
        row = ReportSchedule(
            tenant_id=tenant_id,
            user_id=user_id,
            report_key="inventory_stock",
            name="Failing schedule",
            filters_json="{}",
            frequency="daily",
            send_at=time(9, 0),
            timezone="UTC",
            next_run_at=due,
            recipients_json="[]",
            format="xlsx",
            is_active=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        ran = run_due_schedules(db)
        assert ran == 1
        mock_send.assert_not_called()
        exec_row = db.scalar(
            select(ReportScheduleExecution).where(ReportScheduleExecution.schedule_id == row.id)
        )
        assert exec_row is not None
        assert exec_row.status == "failed"
        db.refresh(row)
        assert row.last_status == "failed"
        assert row.retry_count == 1
        assert row.next_run_at is not None
        nxt = row.next_run_at
        if nxt.tzinfo is None:
            nxt = nxt.replace(tzinfo=timezone.utc)
        assert nxt > datetime.now(timezone.utc) - timedelta(minutes=1)
    finally:
        db.close()


@patch("app.services.reports.export.export_report")
@patch("app.services.email_service.smtp_is_configured", return_value=False)
def test_run_due_schedules_idempotent_on_repeated_ticks(mock_smtp, mock_export, register_admin):
    """After success, next_run moves forward — a second tick must not re-execute."""
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    mock_export.return_value = {"download_url": "/downloads/once.xlsx"}
    db = _db()
    try:
        due = datetime.now(timezone.utc) - timedelta(minutes=5)
        row = ReportSchedule(
            tenant_id=tenant_id,
            user_id=user_id,
            report_key="inventory_stock",
            name="Once only",
            filters_json="{}",
            frequency="daily",
            send_at=time(9, 0),
            timezone="UTC",
            next_run_at=due,
            recipients_json="[]",
            format="xlsx",
            is_active=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        assert run_due_schedules(db) == 1
        first_exec_count = db.scalar(
            select(func.count()).select_from(ReportScheduleExecution).where(
                ReportScheduleExecution.schedule_id == row.id
            )
        )
        assert first_exec_count == 1
        db.refresh(row)
        assert row.next_run_at is not None

        assert run_due_schedules(db) == 0
        second_exec_count = db.scalar(
            select(func.count()).select_from(ReportScheduleExecution).where(
                ReportScheduleExecution.schedule_id == row.id
            )
        )
        assert second_exec_count == 1
        assert mock_export.call_count == 1
    finally:
        db.close()


def test_scheduler_releases_lock_after_inner_rollback(register_admin):
    """Advisory lock must be released even when a tenant path rolls back."""
    register_admin()
    with patch("app.services.automation.scheduler.SessionLocal") as mock_session_local:
        db = MagicMock()
        mock_session_local.return_value = db
        db.scalars.return_value.all.return_value = [1]

        def _boom_then_ok(_db, _tid):
            raise RuntimeError("tenant failed")

        with patch(
            "app.services.automation.scheduler_lock.try_acquire_scheduler_lock",
            return_value=True,
        ), patch(
            "app.services.automation.scheduler_lock.release_scheduler_lock",
        ) as release, patch(
            "app.services.automation.engine.run_scheduled_automations_for_tenant",
            side_effect=_boom_then_ok,
        ), patch(
            "app.services.reports.schedules_service.run_due_schedules",
            return_value=0,
        ):
            _run_all_tenants()
        release.assert_called_once_with(db)
        db.rollback.assert_called()
        db.close.assert_called_once()


def test_schedule_tenant_isolation_and_rbac(register_admin, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    other = register_admin()
    limited = make_restricted_user(tenant_id, ["sales:read"], role_name="Sales Rep")

    db = _db()
    try:
        owner = db.get(User, admin["user"]["id"])
        stranger = db.get(User, other["user"]["id"])
        limited_user = db.scalar(select(User).where(User.email == limited["email"]))
        assert owner and stranger and limited_user

        payload = ReportScheduleCreate(
            report_key="inventory_stock",
            name="Owner only",
            filters={},
            frequency="daily",
            send_at=time(8, 0),
            recipients=[],
            format="xlsx",
            is_active=True,
        )
        created = create_schedule(db, owner, payload)

        with pytest.raises(HTTPException) as denied:
            create_schedule(db, limited_user, payload)
        assert denied.value.status_code == 403

        with pytest.raises(HTTPException) as cross:
            list_executions(db, stranger, created.id)
        assert cross.value.status_code in (403, 404)
    finally:
        db.close()
