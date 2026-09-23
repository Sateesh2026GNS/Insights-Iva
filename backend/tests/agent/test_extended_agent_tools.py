"""Extended shared AI assistant tools — RBAC and integration boundaries."""

import pytest

from app.core.database import SessionLocal
from app.services.agent.context import build_agent_context
from app.services.agent.extended_agent_tools import (
    search_erp_knowledge_documents,
    search_job_opportunities,
    SearchDocumentsInput,
    JobSearchInput,
)
from app.services.agent.tool_registry import user_may_use_tool_name


def test_job_search_returns_not_configured(register_admin):
    admin = register_admin()
    db = SessionLocal()
    try:
        user = db.get(__import__("app.models.user", fromlist=["User"]).User, admin["user"]["id"])
        ctx = build_agent_context(db, user)
        result = search_job_opportunities(db, ctx, JobSearchInput())
        assert result.get("error") == "integration_not_configured"
    finally:
        db.close()


def test_weekly_report_tool_registered_for_sales_manager(register_admin):
    admin = register_admin()
    db = SessionLocal()
    try:
        from app.models.user import User

        user = db.get(User, admin["user"]["id"])
        ctx = build_agent_context(db, user)
        assert user_may_use_tool_name(ctx, "get_weekly_business_report")
        assert user_may_use_tool_name(ctx, "create_sales_order")
    finally:
        db.close()


def test_document_search_denied_without_documents_permission(register_admin, make_restricted_user):
    admin = register_admin()
    headers_user = make_restricted_user(admin["user"]["tenant_id"], ["production"])
    db = SessionLocal()
    try:
        from app.models.user import User

        from sqlalchemy import select

        user = db.scalar(select(User).where(User.email == headers_user["email"]))
        ctx = build_agent_context(db, user)
        result = search_erp_knowledge_documents(db, ctx, SearchDocumentsInput(query="GRN"))
        assert result.get("error")
        assert "permission" in result["error"].lower()
    finally:
        db.close()
