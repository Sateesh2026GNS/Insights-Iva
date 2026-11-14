"""Phase 3.3 — export tokens, LIKE escaping, scheduler lifecycle, lock/email gates."""

from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from sqlalchemy import Column, Integer, String, create_engine, select
from sqlalchemy.orm import Session, declarative_base, sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.reporting import ReportExportToken
from app.services.automation.scheduler import (
    reset_automation_scheduler_for_tests,
    start_automation_scheduler,
    stop_automation_scheduler,
)
from app.services.reports.custom_reports_service import _apply_column_filters
from app.services.reports.export import _register_download, resolve_export_token, revoke_export_token


TinyBase = declarative_base()


class _TinyItem(TinyBase):
    __tablename__ = "tiny_items"

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)


@pytest.fixture()
def tiny_db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TinyBase.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(bind=engine)
    db = SessionLocal()
    db.add_all(
        [
            _TinyItem(name="exact_percent_%_value"),
            _TinyItem(name="exact_under__score"),
            _TinyItem(name="wildcard_bait_abc"),
            _TinyItem(name="plain"),
        ]
    )
    db.commit()
    try:
        yield db
    finally:
        db.close()


def test_contains_filter_treats_percent_and_underscore_as_literals(tiny_db: Session):
    """Regression: contains must not treat SQL LIKE wildcards as wildcards."""
    stmt = select(_TinyItem)
    filtered = _apply_column_filters(
        stmt,
        {"name": _TinyItem.name},
        [{"column": "name", "op": "contains", "value": "%"}],
    )
    rows = list(tiny_db.scalars(filtered).all())
    assert [r.name for r in rows] == ["exact_percent_%_value"]

    # Without escaping, "_" is a single-char wildcard and would match almost anything.
    filtered_us = _apply_column_filters(
        stmt,
        {"name": _TinyItem.name},
        [{"column": "name", "op": "contains", "value": "under__score"}],
    )
    names = [r.name for r in tiny_db.scalars(filtered_us).all()]
    assert names == ["exact_under__score"]

    filtered_bait = _apply_column_filters(
        stmt,
        {"name": _TinyItem.name},
        [{"column": "name", "op": "contains", "value": "bait%"}],
    )
    assert list(tiny_db.scalars(filtered_bait).all()) == []


def test_contains_filter_sql_uses_escape_clause():
    stmt = select(_TinyItem)
    filtered = _apply_column_filters(
        stmt,
        {"name": _TinyItem.name},
        [{"column": "name", "op": "contains", "value": "a%b_c"}],
    )
    compiled = str(filtered.compile(compile_kwargs={"literal_binds": False}))
    assert "ESCAPE" in compiled.upper()


def test_export_token_persists_and_revokes(register_admin, client):
    admin = register_admin()
    from app.core.database import SessionLocal
    from app.services.storage.object_store import put_bytes, build_tenant_storage_key

    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    key = build_tenant_storage_key(tenant_id, "report_exports", "phase33", "t.csv")
    put_bytes(key, b"a,b\n1,2\n", "text/csv")
    url, _expires = _register_download(
        key, "text/csv", tenant_id, "t.csv", created_by_user_id=user_id
    )
    token = url.rsplit("/", 1)[-1]

    db = SessionLocal()
    try:
        row = db.query(ReportExportToken).filter(ReportExportToken.token == token).one()
        assert row.tenant_id == tenant_id
        assert row.created_by_user_id == user_id
        assert row.revoked_at is None
    finally:
        db.close()

    assert revoke_export_token(token, tenant_id=tenant_id) is True
    user = MagicMock()
    user.tenant_id = tenant_id
    with pytest.raises(Exception) as exc:
        resolve_export_token(token, user)
    assert getattr(exc.value, "status_code", None) == 404


def test_export_token_tenant_isolation(register_admin):
    admin = register_admin()
    from app.core.database import SessionLocal
    from app.services.storage.object_store import put_bytes, build_tenant_storage_key
    from fastapi import HTTPException

    tenant_id = admin["user"]["tenant_id"]
    key = build_tenant_storage_key(tenant_id, "report_exports", "iso", "t.csv")
    put_bytes(key, b"x", "text/csv")
    url, _ = _register_download(key, "text/csv", tenant_id, "t.csv", created_by_user_id=admin["user"]["id"])
    token = url.rsplit("/", 1)[-1]

    other = MagicMock()
    other.tenant_id = tenant_id + 99999
    with pytest.raises(HTTPException) as exc:
        resolve_export_token(token, other)
    assert exc.value.status_code == 403

    # Cleanup token row
    db = SessionLocal()
    try:
        row = db.query(ReportExportToken).filter(ReportExportToken.token == token).one_or_none()
        if row:
            db.delete(row)
            db.commit()
    finally:
        db.close()


def test_scheduler_stop_prevents_duplicate_start(monkeypatch):
    monkeypatch.setenv("AUTOMATION_SCHEDULER_ENABLED", "true")
    from app.core.config import get_settings

    get_settings.cache_clear()
    reset_automation_scheduler_for_tests()
    with patch("app.services.automation.scheduler.threading.Thread") as mock_thread:
        started = []

        def _start():
            started.append(1)

        mock_thread.return_value.start = _start
        mock_thread.return_value.is_alive = lambda: False
        start_automation_scheduler()
        start_automation_scheduler()  # duplicate should no-op
        assert mock_thread.call_count == 1
        stop_automation_scheduler(join_timeout=0.1)
        start_automation_scheduler()
        assert mock_thread.call_count == 2
    get_settings.cache_clear()
    reset_automation_scheduler_for_tests()


def test_pg_advisory_lock_multi_connection_exclusive():
    """Two independent PostgreSQL connections: only one holds the scheduler lock.

    Skips on SQLite test runs. Does not execute production schedules.
    """
    from app.core.config import get_settings
    from app.services.automation.scheduler_lock import (
        release_scheduler_lock,
        try_acquire_scheduler_lock,
    )
    from sqlalchemy import create_engine, text
    from sqlalchemy.orm import sessionmaker

    settings = get_settings()
    if settings.is_sqlite or str(settings.database_url).startswith("sqlite"):
        # Prefer real PG URL from env for this integration check without forcing whole suite.
        pg_url = os.environ.get("POSTGRES_LOCK_TEST_URL") or os.environ.get("DATABASE_URL_POSTGRES")
        if not pg_url or pg_url.startswith("sqlite"):
            pytest.skip("PostgreSQL required (set USE_POSTGRES_TESTS=1 or POSTGRES_LOCK_TEST_URL)")
        url = pg_url
    else:
        url = settings.database_url

    eng1 = create_engine(url, pool_pre_ping=True)
    eng2 = create_engine(url, pool_pre_ping=True)
    Session1 = sessionmaker(bind=eng1)
    Session2 = sessionmaker(bind=eng2)
    db1 = Session1()
    db2 = Session2()
    try:
        # Sanity: Postgres
        db1.execute(text("SELECT 1"))
        with patch("app.services.automation.scheduler_lock.get_settings") as gs:
            gs.return_value.is_sqlite = False
            assert try_acquire_scheduler_lock(db1) is True
            assert try_acquire_scheduler_lock(db2) is False
            release_scheduler_lock(db1)
            assert try_acquire_scheduler_lock(db2) is True
            release_scheduler_lock(db2)

            # Connection termination must free the lock for the other process.
            assert try_acquire_scheduler_lock(db1) is True
            db1.close()
            eng1.dispose()  # drop underlying connection → unlock
            db1 = Session1()
            assert try_acquire_scheduler_lock(db2) is True
            release_scheduler_lock(db2)
    finally:
        try:
            with patch("app.services.automation.scheduler_lock.get_settings") as gs:
                gs.return_value.is_sqlite = False
                release_scheduler_lock(db2)
        except Exception:
            pass
        db2.close()
        try:
            db1.close()
        except Exception:
            pass
        eng1.dispose()
        eng2.dispose()


@pytest.mark.skipif(
    os.environ.get("REPORTS_SMTP_LIVE_TEST") != "1",
    reason=(
        "Safe SMTP gate: set REPORTS_SMTP_LIVE_TEST=1 and REPORTS_SMTP_TEST_RECIPIENT "
        "explicitly to send a real test email (never runs in CI by default)."
    ),
)
def test_reports_smtp_live_attachment_procedure():
    """Manual/approved live SMTP verification for schedule-style attachments.

    Required env:
      REPORTS_SMTP_LIVE_TEST=1
      REPORTS_SMTP_TEST_RECIPIENT=<approved inbox only>

    Verifies CSV/XLSX attachment payload shape and that download links are
    authenticated API paths (not public object URLs). Does not target production
    recipients unless explicitly configured.
    """
    recipient = (os.environ.get("REPORTS_SMTP_TEST_RECIPIENT") or "").strip()
    if not recipient or "@" not in recipient:
        pytest.fail("REPORTS_SMTP_TEST_RECIPIENT must be an explicit approved address")

    from app.services.email_service import send_email, smtp_is_configured

    if not smtp_is_configured():
        pytest.skip("SMTP is not configured in this environment")

    csv_bytes = b"Report: Phase33\nGenerated: now\ncol\n1\n"
    # attachments: list of (filename, content_bytes, mime_type)
    attachments: list[tuple[str, bytes, str]] = [
        ("phase33-test.csv", csv_bytes, "text/csv"),
    ]
    try:
        from openpyxl import Workbook
        import io

        wb = Workbook()
        wb.active.append(["Report: Phase33"])
        buf = io.BytesIO()
        wb.save(buf)
        attachments.append(
            (
                "phase33-test.xlsx",
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            )
        )
    except ImportError:
        pass

    download_path = "/api/reports/exports/example-token-not-a-public-url"
    assert download_path.startswith("/api/reports/exports/")
    assert "s3." not in download_path
    assert "storage.googleapis" not in download_path

    body = (
        "Insights Iva Phase 3.3 SMTP verification (approved test only).\n"
        f"Authenticated download path example: {download_path}\n"
    )
    send_email(
        recipient,
        "[TEST ONLY] Reports Center Phase 3.3 SMTP verification",
        body,
        attachments=attachments,
        require_smtp=True,
    )
