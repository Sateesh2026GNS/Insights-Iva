"""Write tools require confirm; agent chat rate limit returns 429."""

from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException

from app.services.agent.confirmation import create_confirmation, pop_confirmation
from app.services.agent.context import AgentContext
from app.services.agent.orchestrator import execute_confirmed_write
from app.services.agent.tools import CreateMaterialIssueInput, prepare_create_material_issue


def test_write_tool_prepare_does_not_issue_stock():
    user = MagicMock()
    user.tenant_id = 1
    ctx = AgentContext(
        tenant_id=1,
        user_id=1,
        role="Store Manager",
        allowed_warehouse_ids=(1,),
        user=user,
    )
    with patch("app.services.agent.tools.get_settings") as gs:
        gs.return_value.agent_write_tools_enabled = True
        with patch("app.services.agent.context.get_role_names", return_value=["Store Manager"]):
            out = prepare_create_material_issue(
                ctx,
                CreateMaterialIssueInput(
                    job_card_no="JC-1",
                    items=[{"item_id": 1, "qty": 2}],
                ),
            )
    assert out.tool_name == "create_material_issue"
    assert "confirm" in out.summary.lower()


def test_execute_confirmed_write_rejects_without_valid_token_flow():
    user = MagicMock()
    user.tenant_id = 1
    ctx = AgentContext(
        tenant_id=1,
        user_id=1,
        role="Store Manager",
        allowed_warehouse_ids=(1,),
        user=user,
    )
    with patch("app.services.agent.orchestrator.get_settings") as gs:
        gs.return_value.agent_write_tools_enabled = True
        with patch("app.services.agent.context.get_role_names", return_value=["Store Manager"]):
            result = execute_confirmed_write(
                MagicMock(),
                ctx,
                "create_material_issue",
                {"job_card_no": "JC-1", "items": []},
            )
    assert result.get("success") is False


def test_confirmation_token_single_use():
    token = create_confirmation(
        tenant_id=1,
        user_id=2,
        tool_name="create_material_issue",
        payload={"x": 1},
        summary="test",
    )
    first = pop_confirmation(token, 1, 2)
    assert first is not None
    assert pop_confirmation(token, 1, 2) is None


def test_agent_rate_limit_scope_configured():
    from app.middleware.security import check_rate_limit
    from fastapi import Request

    req = Request({"type": "http", "path": "/api/v1/agent/chat", "headers": []})
    with patch("app.middleware.security.get_settings") as gs:
        gs.return_value.api_agent_rate_limit = 1
        gs.return_value.api_agent_rate_window_seconds = 3600
        check_rate_limit(req, email="user-99", scope="api_agent")
        with pytest.raises(HTTPException) as exc:
            check_rate_limit(req, email="user-99", scope="api_agent")
        assert exc.value.status_code == 429
