"""Phase 3.1 — custom report shares + scheduled email attachments (mocked SMTP)."""

from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from unittest.mock import patch

import pytest
from fastapi import HTTPException
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.reporting import ReportSchedule, ReportScheduleExecution
from app.models.user import User
from app.services.reports.custom_reports_service import create_custom_report
from app.services.reports.schedules_service import list_executions, run_due_schedules
from app.services.reports.share_service import create_share, list_shares, revoke_share


def _db():
    return SessionLocal()


def test_share_create_list_revoke_and_dataset_gate(register_admin, make_restricted_user):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    limited = make_restricted_user(tenant_id, ["inventory"], role_name="Store Clerk")
    db = _db()
    try:
        owner = db.get(User, admin["user"]["id"])
        recipient = db.scalar(select(User).where(User.email == limited["email"]))
        created = create_custom_report(
            db,
            owner,
            {
                "name": "Share me",
                "base_source": "sales_orders",
                "columns": ["order_number", "total_amount"],
            },
        )
        report_id = created["id"]

        # Recipient without sales dataset access must be rejected.
        with pytest.raises(HTTPException) as denied:
            create_share(db, owner, report_id, shared_with_user_id=recipient.id)
        assert denied.value.status_code == 400

        share = create_share(db, owner, report_id, shared_with_role="Sales Manager")
        assert share["shared_with_role"] == "Sales Manager"
        listed = list_shares(db, owner, report_id)
        assert any(s["id"] == share["id"] for s in listed)
        revoke_share(db, owner, report_id, share["id"])
        assert list_shares(db, owner, report_id) == []
    finally:
        db.close()


@patch("app.services.email_service.smtp_is_configured", return_value=True)
@patch("app.services.email_service.send_email")
@patch("app.services.reports.export.export_report")
def test_schedule_email_attaches_csv_xlsx(mock_export, mock_send, mock_smtp, register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    mock_export.return_value = {
        "download_url": "/api/reports/exports/tok123",
        "expires_at": datetime.now(timezone.utc).isoformat(),
        "filename": "inventory_stock.csv",
        "content_type": "text/csv",
        "storage_key": "tenant/1/report_exports/a/inventory_stock.csv",
    }
    db = _db()
    try:
        # Isolate from other due schedules left by earlier tests in the shared DB.
        for existing in db.scalars(
            select(ReportSchedule).where(ReportSchedule.is_active.is_(True))
        ).all():
            existing.is_active = False
            existing.next_run_at = None
        db.commit()

        row = ReportSchedule(
            tenant_id=tenant_id,
            user_id=user_id,
            report_key="inventory_stock",
            name="Attach test",
            filters_json="{}",
            frequency="daily",
            send_at=time(9, 0),
            timezone="UTC",
            next_run_at=datetime.now(timezone.utc) - timedelta(minutes=5),
            recipients_json='["ops@example.com"]',
            format="csv",
            is_active=True,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

        with patch(
            "app.services.storage.object_store.get_bytes",
            return_value=b"col1,col2\n1,2\n",
        ):
            assert run_due_schedules(db) == 1

        mock_send.assert_called_once()
        args, kwargs = mock_send.call_args
        assert args[0] == "ops@example.com"
        attachments = kwargs.get("attachments")
        assert attachments and attachments[0][0] == "inventory_stock.csv"
        assert attachments[0][1] == b"col1,col2\n1,2\n"
        assert "requires login" in args[2].lower() or "Secure download" in args[2]

        history = list_executions(db, db.get(User, user_id), row.id)
        assert len(history) == 1
        assert history[0]["status"] == "success"
        assert history[0]["export_token"] == "/api/reports/exports/tok123"
        assert history[0]["duration_seconds"] is not None
    finally:
        db.close()


def test_execution_history_tenant_isolation(register_admin):
    a = register_admin()
    b = register_admin()
    db = _db()
    try:
        owner_a = db.get(User, a["user"]["id"])
        owner_b = db.get(User, b["user"]["id"])
        sched = ReportSchedule(
            tenant_id=a["user"]["tenant_id"],
            user_id=a["user"]["id"],
            report_key="inventory_stock",
            name="A only",
            filters_json="{}",
            frequency="daily",
            send_at=time(8, 0),
            timezone="UTC",
            next_run_at=None,
            recipients_json="[]",
            format="xlsx",
            is_active=True,
        )
        db.add(sched)
        db.flush()
        db.add(
            ReportScheduleExecution(
                tenant_id=a["user"]["tenant_id"],
                schedule_id=sched.id,
                started_at=datetime.now(timezone.utc),
                finished_at=datetime.now(timezone.utc),
                status="success",
                triggered_by="manual",
            )
        )
        db.commit()
        assert list_executions(db, owner_a, sched.id)
        with pytest.raises(HTTPException) as cross:
            list_executions(db, owner_b, sched.id)
        assert cross.value.status_code in (403, 404)
    finally:
        db.close()
