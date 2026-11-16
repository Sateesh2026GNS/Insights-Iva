"""Smoke: run + gap path for system catalog handlers."""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.services.reports.catalog_service import run_system_report
from app.services.reports.engine import ensure_reports_loaded
from app.services.reports.filters import ReportFilters
from app.services.reports.system_catalog import SYSTEM_REPORTS


class _Role:
    def __init__(self, name: str):
        self.name = name
        self.permissions = None


class _User:
    def __init__(self):
        self.id = 1
        self.tenant_id = 1
        self.roles = [_Role("Admin")]
        self.full_name = "Admin"


@pytest.fixture()
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()


def test_gap_report_returns_gap_payload(db):
    ensure_reports_loaded()
    user = _User()
    gap = next(e for e in SYSTEM_REPORTS if e.data_status == "gap")
    result = run_system_report(
        db,
        user,
        gap.slug,
        ReportFilters(date_from=date(2026, 1, 1), date_to=date(2026, 12, 31)),
    )
    assert result["data_status"] == "gap"
    assert result["rows"] == []
    assert "Data source" in (result.get("gap_message") or "")


def test_implemented_sales_summary_runs_empty(db):
    ensure_reports_loaded()
    user = _User()
    result = run_system_report(
        db,
        user,
        "sales-summary",
        ReportFilters(date_from=date(2026, 1, 1), date_to=date(2026, 12, 31), page=1, page_size=10),
    )
    assert result["report_key"] == "sales-summary"
    assert "columns" in result
    assert result.get("data_status") in ("implemented", "partial")
    assert isinstance(result["rows"], list)
