"""System Reports Center — 56 catalog, RBAC, favorites, visits."""

from __future__ import annotations

from collections import Counter

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.models.reporting import ReportFavorite, ReportVisit
from app.services.reports.catalog_access import user_can_view_system_report
from app.services.reports.catalog_service import (
    add_favorite,
    list_system_catalog,
    record_visit,
    remove_favorite,
    require_system_report_access,
)
from app.services.reports.engine import ensure_reports_loaded
from app.services.reports.system_catalog import EXPECTED_CATEGORY_COUNTS, SYSTEM_REPORTS


class _Role:
    def __init__(self, name: str, permissions=None):
        self.name = name
        self.permissions = permissions


class _User:
    def __init__(self, *, tenant_id: int, user_id: int, role: str, permissions=None):
        self.id = user_id
        self.tenant_id = tenant_id
        self.roles = [_Role(role, permissions)]
        self.full_name = role


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


def test_system_catalog_has_exactly_56_with_category_counts():
    assert len(SYSTEM_REPORTS) == 56
    counts = Counter(e.category for e in SYSTEM_REPORTS)
    assert dict(counts) == EXPECTED_CATEGORY_COUNTS
    assert sum(EXPECTED_CATEGORY_COUNTS.values()) == 56
    slugs = [e.slug for e in SYSTEM_REPORTS]
    assert len(slugs) == len(set(slugs))


def test_store_manager_sees_inventory_not_activity_automation():
    user = _User(tenant_id=1, user_id=10, role="Store Manager")
    visible = [e for e in SYSTEM_REPORTS if user_can_view_system_report(user, e)]
    cats = {e.category for e in visible}
    assert "Inventory" in cats
    assert "Inventory Valuation" in cats
    assert "Activity" not in cats
    assert "Automation" not in cats


def test_operator_blocked_from_finance_report():
    from fastapi import HTTPException

    user = _User(tenant_id=1, user_id=11, role="Operator")
    with pytest.raises(HTTPException) as exc:
        require_system_report_access(user, "invoice-details")
    assert exc.value.status_code == 403


def test_favorites_and_visits_are_per_user(db):
    ensure_reports_loaded()
    a = _User(tenant_id=1, user_id=1, role="Admin")
    b = _User(tenant_id=1, user_id=2, role="Admin")
    slug = "sales-summary"
    add_favorite(db, a, slug)
    record_visit(db, a, slug)

    cat_a = list_system_catalog(db, a, section="favorites")
    cat_b = list_system_catalog(db, b, section="favorites")
    assert any(i["slug"] == slug for i in cat_a["items"])
    assert not any(i["slug"] == slug for i in cat_b["items"])

    visits_a = db.query(ReportVisit).filter_by(user_id=1, report_slug=slug).count()
    visits_b = db.query(ReportVisit).filter_by(user_id=2, report_slug=slug).count()
    assert visits_a == 1
    assert visits_b == 0

    remove_favorite(db, a, slug)
    assert db.query(ReportFavorite).filter_by(user_id=1, report_slug=slug).count() == 0


def test_tenant_isolation_favorites(db):
    ensure_reports_loaded()
    a = _User(tenant_id=1, user_id=1, role="Admin")
    other = _User(tenant_id=2, user_id=99, role="Admin")
    add_favorite(db, a, "inventory-summary")
    cat_other = list_system_catalog(db, other, section="favorites")
    assert cat_other["items"] == []
