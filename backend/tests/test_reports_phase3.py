"""Phase 3 — custom reports, shares, schedule next-run computation."""

from __future__ import annotations

from datetime import date, datetime, time, timezone

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.services.reports.custom_reports_service import (
    create_custom_report,
    list_available_datasets,
    run_custom_report,
)
from app.services.reports.dataset_registry import DATASET_REGISTRY
from app.services.reports.schedules_service import compute_next_run_at


class _Role:
    def __init__(self, name: str):
        self.name = name
        self.permissions = None


class _User:
    def __init__(self, *, user_id=1, tenant_id=1, role="Admin"):
        self.id = user_id
        self.tenant_id = tenant_id
        self.roles = [_Role(role)]
        self.full_name = role
        self.email = f"{role.lower().replace(' ', '')}@test.local"
        self.is_active = True


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


def test_dataset_registry_allowlist():
    assert "sales_orders" in DATASET_REGISTRY
    assert len(DATASET_REGISTRY) >= 4


def test_admin_sees_datasets():
    user = _User(role="Admin")
    datasets = list_available_datasets(user)
    assert any(d["key"] == "sales_orders" for d in datasets)


def test_store_manager_cannot_create_sales_custom_report(db):
    user = _User(role="Store Manager")
    with pytest.raises(HTTPException) as exc:
        create_custom_report(
            db,
            user,
            {
                "name": "Hack",
                "base_source": "sales_orders",
                "columns": ["order_number", "total_amount"],
            },
        )
    assert exc.value.status_code in (403, 400)


def test_admin_creates_and_runs_custom_report(db):
    user = _User(role="Admin")
    created = create_custom_report(
        db,
        user,
        {
            "name": "Sales totals",
            "base_source": "sales_orders",
            "columns": ["customer", "total_amount"],
            "group_by": ["customer"],
            "aggregations": {"total_amount": "sum"},
            "filters": {"date_from": "2026-01-01", "date_to": "2026-12-31"},
        },
    )
    assert created["id"]
    assert created["base_source"] == "sales_orders"
    result = run_custom_report(db, user, created["id"])
    assert "rows" in result
    assert result["pagination"]["total_rows"] >= 0


def test_rejects_unknown_column(db):
    user = _User(role="Admin")
    with pytest.raises(HTTPException) as exc:
        create_custom_report(
            db,
            user,
            {
                "name": "Bad",
                "base_source": "sales_orders",
                "columns": ["not_a_real_column"],
            },
        )
    assert exc.value.status_code == 400


def test_compute_next_run_advances_daily():
    after = datetime(2026, 11, 11, 10, 0, tzinfo=timezone.utc)
    nxt = compute_next_run_at(
        frequency="daily",
        send_at=time(9, 0),
        tz_name="UTC",
        after=after,
    )
    assert nxt is not None
    assert nxt > after
