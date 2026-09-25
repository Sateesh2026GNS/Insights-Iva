"""Sales Manager daily my-work activity."""

from __future__ import annotations

import uuid
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.role import Role
from app.models.sales import Lead
from app.models.security import AuditLog
from app.models.user import User, user_roles
from app.services.auth_service import hash_password
from app.services.sales_my_work_service import get_sales_my_work


def test_my_work_returns_lead_created_on_date(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    db = SessionLocal()
    try:
        user = db.get(__import__("app.models.user", fromlist=["User"]).User, user_id)
        assert user
        user.full_name = "Sales Manager User"
        day = date(2026, 9, 23)
        ist = ZoneInfo("Asia/Kolkata")
        created = datetime.combine(day, time(9, 30), tzinfo=ist)
        lead = Lead(
            tenant_id=tenant_id,
            name="ABC Industries",
            company="ABC Industries",
            status="new",
            sales_executive=user.full_name,
        )
        lead.created_at = created
        lead.updated_at = created
        db.add(lead)
        db.commit()

        payload = get_sales_my_work(db, tenant_id, user, activity_date="2026-09-23")
        assert payload.activity_date == "2026-09-23"
        titles = [a.title for a in payload.timeline]
        assert "Lead Created" in titles
        assert any("ABC" in a.subtitle for a in payload.timeline)
    finally:
        db.close()


def test_my_work_api_requires_auth(client):
    res = client.get("/sales/my-work", params={"date": "2026-09-23"})
    assert res.status_code in (401, 403)


def test_my_work_includes_assigned_lead_for_sales_executive(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        user.full_name = "Manager One"
        day = date(2026, 9, 25)
        ist = ZoneInfo("Asia/Kolkata")
        created = datetime.combine(day, time(10, 0), tzinfo=ist)
        lead = Lead(
            tenant_id=tenant_id,
            name="Sep 25 Lead",
            company="Sep 25 Co",
            status="new",
            sales_executive="Manager One",
        )
        lead.created_at = created
        lead.updated_at = created
        db.add(lead)
        db.commit()

        payload = get_sales_my_work(db, tenant_id, user, activity_date="2026-09-25")
        assert any(a.title == "Lead Created" and "Sep 25" in a.subtitle for a in payload.timeline)
    finally:
        db.close()


def test_my_work_includes_audit_attributed_lead(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    user_id = admin["user"]["id"]
    db = SessionLocal()
    try:
        user = db.get(User, user_id)
        day = date(2026, 9, 25)
        ist = ZoneInfo("Asia/Kolkata")
        created = datetime.combine(day, time(11, 0), tzinfo=ist)
        lead = Lead(
            tenant_id=tenant_id,
            name="Audit Lead",
            company="Audit Co",
            status="new",
            sales_executive="Someone Else",
        )
        lead.created_at = created
        lead.updated_at = created
        db.add(lead)
        db.flush()
        db.add(
            AuditLog(
                tenant_id=tenant_id,
                user_id=user.id,
                action="update",
                resource="lead",
                resource_id=lead.id,
                created_at=created,
            )
        )
        db.commit()

        payload = get_sales_my_work(db, tenant_id, user, activity_date="2026-09-25")
        assert any("Audit" in a.subtitle for a in payload.timeline)
    finally:
        db.close()
