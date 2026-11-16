"""Tests for transaction rollback and exception handling during alert creation / emission.

Covers:
- emit_alert() rollback on DB commit failure (OperationalError -> 503)
- emit_alert() rollback on generic exception (RuntimeError -> 500)
- emit_alert(commit=False) uses SAVEPOINT and does not outer-rollback
- create_alert() service rollback on DB commit failure (OperationalError -> 503)
- POST /alerts endpoint error handling (503 and 500)
"""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError

from app.core.database import SessionLocal
from app.models.automation import AutomationExecution, AutomationRule
from app.schemas.alert import AlertCreate
from app.services.alert_event_service import emit_alert
from app.services.alert_service import create_alert
from app.services.automation.execution_log import get_execution_by_key, record_execution


def test_emit_alert_rolls_back_on_commit_failure():
    """Simulate a database commit failure during emit_alert and verify rollback."""
    mock_db = MagicMock()
    mock_db.commit.side_effect = OperationalError(
        "INSERT INTO alerts", {}, Exception("DB connection lost during alert commit")
    )

    try:
        emit_alert(
            mock_db,
            tenant_id=1,
            alert_type="low_stock",
            title="Low Stock Warning",
            message="Item X is below threshold",
        )
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 503
        assert "Database connection unavailable" in exc.detail
        mock_db.rollback.assert_called_once()


def test_emit_alert_rolls_back_on_generic_exception():
    """Simulate an unexpected failure during emit_alert and verify rollback."""
    mock_db = MagicMock()
    mock_db.flush.side_effect = RuntimeError("Unexpected flush error")

    try:
        emit_alert(
            mock_db,
            tenant_id=1,
            alert_type="system",
            title="System Alert",
        )
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 500
        assert "Failed to emit alert" in exc.detail
        mock_db.rollback.assert_called_once()


def test_emit_alert_commit_false_uses_nested_and_skips_outer_rollback():
    """commit=False must SAVEPOINT alert work and never db.rollback() the caller."""
    mock_db = MagicMock()
    mock_db.flush.side_effect = OperationalError(
        "INSERT INTO alerts", {}, Exception("alert flush failed")
    )

    with pytest.raises(HTTPException) as exc:
        emit_alert(
            mock_db,
            tenant_id=1,
            alert_type="low_stock",
            title="Nested failure",
            commit=False,
            fanout=False,
        )
    assert exc.value.status_code == 503
    mock_db.begin_nested.assert_called()
    mock_db.rollback.assert_not_called()


def test_emit_alert_commit_false_preserves_unrelated_automation_history(register_admin):
    """Failed nested emit must leave prior automation executions intact."""
    tenant_id = register_admin()["user"]["tenant_id"]
    db = SessionLocal()
    try:
        rule = AutomationRule(
            tenant_id=tenant_id,
            code="preserve_hist",
            name="Preserve",
            event_type="stock.low",
            enabled=True,
        )
        db.add(rule)
        db.flush()
        key = "preserve_hist:item:1:2026-11-11"
        record_execution(
            db,
            tenant_id=tenant_id,
            rule=rule,
            event_type=rule.event_type,
            idempotency_key=key,
            status="success",
            action_summary="already done",
        )

        with patch(
            "app.services.alert_event_service.fanout_alert_notifications",
            side_effect=OperationalError("fanout", {}, Exception("fanout failed")),
        ):
            with pytest.raises(HTTPException):
                emit_alert(
                    db,
                    tenant_id=tenant_id,
                    alert_type="low_stock",
                    title="Should not wipe history",
                    commit=False,
                    fanout=True,
                )

        db.commit()
        preserved = get_execution_by_key(db, tenant_id, key)
        assert preserved is not None
        assert preserved.status == "success"
        count = db.scalar(
            select(func.count()).select_from(AutomationExecution).where(
                AutomationExecution.tenant_id == tenant_id,
                AutomationExecution.idempotency_key == key,
            )
        )
        assert count == 1
    finally:
        db.close()


def test_create_alert_service_rolls_back_on_commit_failure():
    """Simulate a DB failure during create_alert and verify rollback."""
    mock_db = MagicMock()
    mock_db.commit.side_effect = OperationalError(
        "INSERT INTO alerts", {}, Exception("DB commit failure")
    )

    payload = AlertCreate(
        tenant_id=1,
        alert_type="quality",
        title="Quality Issue",
        message="Defect detected",
        severity="high",
    )

    try:
        create_alert(mock_db, payload)
        assert False, "Should have raised HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 503
        assert "Database connection unavailable" in exc.detail
        mock_db.rollback.assert_called_once()


def test_create_alert_endpoint_handles_db_error(client, register_admin):
    """POST /alerts with DB failure returns 503."""
    admin_auth = register_admin()

    with patch(
        "app.api.alerts.create_alert",
        side_effect=OperationalError("INSERT", {}, Exception("Database offline")),
    ):
        resp = client.post(
            "/alerts",
            json={
                "tenant_id": 1,
                "alert_type": "maintenance",
                "title": "Scheduled Maintenance",
                "severity": "medium",
            },
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 503
    data = resp.json()
    assert "detail" in data
    assert "Database connection unavailable" in data["detail"]


def test_create_alert_endpoint_handles_generic_exception(client, register_admin):
    """POST /alerts with generic failure returns 500."""
    admin_auth = register_admin()

    with patch(
        "app.api.alerts.create_alert",
        side_effect=RuntimeError("Unexpected alert creation crash"),
    ):
        resp = client.post(
            "/alerts",
            json={
                "tenant_id": 1,
                "alert_type": "maintenance",
                "title": "Scheduled Maintenance",
                "severity": "medium",
            },
            headers=admin_auth["headers"],
        )

    assert resp.status_code == 500
    data = resp.json()
    assert "detail" in data
    assert "Failed to create alert" in data["detail"]
