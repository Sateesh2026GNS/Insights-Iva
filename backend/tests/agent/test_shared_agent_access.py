"""Shared AI agent — role access and tool schema per role."""

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import SessionLocal
from app.models.user import User
from app.services.agent.access import user_can_use_shared_agent
from app.services.agent.context import build_agent_context
from app.services.agent.tool_registry import openai_tools_for_context
from tests.agent.test_tool_scoping import _create_role_user, _ctx_for_user


def test_user_can_use_shared_agent_all_roles(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        for role in (
            "Operator",
            "Sales Manager",
            "Store Manager",
            "Production Manager",
            "Quality Control",
            "HR Manager",
            "Accountant",
        ):
            u = _create_role_user(db, tenant_id, role, f"{role} AI", f"{role.lower()}-ai")
            db.commit()
            user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == u.id))
            assert user_can_use_shared_agent(user), role
    finally:
        db.close()


def test_production_manager_has_production_tools(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        u = _create_role_user(db, tenant_id, "Production Manager", "PM AI", "pm-ai")
        db.commit()
        user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == u.id))
        ctx = build_agent_context(db, user)
        names = {t["function"]["name"] for t in openai_tools_for_context(ctx)}
        assert "get_work_order_stats_deep" in names
        assert "get_stock" in names
        assert "get_todays_work_orders" not in names or "get_work_order_stats_deep" in names
    finally:
        db.close()


def test_get_business_summary_does_not_crash(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        u = _create_role_user(db, tenant_id, "Admin", "Admin Biz", "admin-biz")
        db.commit()
        user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == u.id))
        from app.services.agent.context import build_agent_context
        from app.services.agent.module_agent_tools import EmptyInput, get_business_summary

        ctx = build_agent_context(db, user)
        res = get_business_summary(db, ctx, EmptyInput())
        assert res.total_count >= 1
        assert res.rows
    finally:
        db.close()


def test_quality_role_has_quality_summary_only_not_sales(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]
    db = SessionLocal()
    try:
        u = _create_role_user(db, tenant_id, "Quality Control", "QC AI", "qc-ai")
        db.commit()
        user = db.scalar(select(User).options(selectinload(User.roles)).where(User.id == u.id))
        ctx = _ctx_for_user(db, user)
        names = {t["function"]["name"] for t in openai_tools_for_context(ctx)}
        assert "get_quality_summary" in names
        assert "get_sales_orders" not in names
    finally:
        db.close()
