"""Orchestrator writes ai_agent_log rows for tools and final response."""

from unittest.mock import MagicMock, patch

import pytest

from app.services.agent.context import AgentContext
from app.services.agent.orchestrator import run_agent_chat


@patch("app.services.agent.orchestrator.log_agent_event")
@patch("app.services.agent.orchestrator.AgentLlmClient")
@patch("app.services.agent.orchestrator.append_message")
@patch("app.services.agent.orchestrator.get_or_create_conversation")
@patch("app.services.agent.orchestrator.recent_messages_for_llm", return_value=[])
def test_chat_logs_tool_and_final(
    _recent,
    mock_get_conv,
    _append,
    mock_llm_cls,
    mock_log,
):
    conv = MagicMock()
    conv.external_id = "conv-1"
    conv.id = 1
    mock_get_conv.return_value = conv

    llm = MagicMock()
    llm.enabled = True
    mock_llm_cls.return_value = llm

    tool_call_msg = {
        "message": {
            "tool_calls": [
                {
                    "id": "tc1",
                    "function": {"name": "get_stock", "arguments": "{}"},
                }
            ]
        }
    }
    final_msg = {"message": {"content": "Stock is 10 units."}}

    llm.chat.side_effect = [ {"choices": [tool_call_msg]}, {"choices": [final_msg]} ]

    user = MagicMock()
    user.tenant_id = 1
    user.id = 2
    ctx = AgentContext(
        tenant_id=1,
        user_id=2,
        role="Store Manager",
        allowed_warehouse_ids=(1,),
        user=user,
    )

    with patch("app.services.agent.orchestrator.execute_tool_async") as mock_tool:
        from app.services.agent.tools import StockResult

        mock_tool.return_value = StockResult(
            rows=[{"item": "X", "on_hand_qty": 10}],
            truncated=False,
            total_count=1,
            generated_at="2026-01-01T00:00:00+00:00",
            source_report_key="current_stock",
            report_title="Current Stock",
        )
        import asyncio

        asyncio.run(run_agent_chat(MagicMock(), ctx, "stock?", None))

    tool_logs = [c for c in mock_log.call_args_list if c.kwargs.get("tool_name")]
    final_logs = [c for c in mock_log.call_args_list if c.kwargs.get("tool_name") is None]
    assert len(tool_logs) >= 1
    assert len(final_logs) >= 1
