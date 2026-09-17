"""Agent OpenAI client — schemas, tool dispatch parsing, missing-key fallback."""

from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services.agent.llm_client import AgentLlmClient, read_tool_schemas
from app.services.agent.orchestrator import run_agent_chat
from app.services.agent.tools import READ_TOOL_NAMES


def test_read_tool_schemas_are_valid_openai_functions():
    schemas = read_tool_schemas()
    assert len(schemas) == len(READ_TOOL_NAMES)
    names = {t["function"]["name"] for t in schemas}
    assert names == set(READ_TOOL_NAMES)
    for tool in schemas:
        assert tool["type"] == "function"
        fn = tool["function"]
        assert fn["name"]
        assert fn["description"]
        params = fn["parameters"]
        assert params.get("type") == "object"
        assert "properties" in params


@patch("app.services.agent.llm_client.OpenAI")
def test_chat_parses_tool_calls_from_openai_response(mock_openai_cls):
    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client

    tool_call = SimpleNamespace(
        id="call_abc",
        function=SimpleNamespace(
            name="get_stock",
            arguments=json.dumps({"item_query": "PET", "warehouse_ids": [99]}),
        ),
    )
    assistant_msg = SimpleNamespace(content="", tool_calls=[tool_call])
    mock_client.chat.completions.create.return_value = SimpleNamespace(
        choices=[SimpleNamespace(message=assistant_msg)]
    )

    with patch("app.services.agent.llm_client.get_settings") as gs:
        settings = MagicMock()
        settings.openai_api_key = "sk-test"
        settings.openai_model = "gpt-4o"
        settings.openai_base_url = None
        settings.openai_timeout_seconds = 30
        gs.return_value = settings

        client = AgentLlmClient()
        out = client.chat(
            [{"role": "user", "content": "stock?"}],
            tools=read_tool_schemas(),
        )

    assert out.get("error") is None
    msg = out["choices"][0]["message"]
    assert msg["tool_calls"][0]["function"]["name"] == "get_stock"
    args = json.loads(msg["tool_calls"][0]["function"]["arguments"])
    assert args["item_query"] == "PET"


@patch("app.services.agent.llm_client.OpenAI")
def test_authentication_error_maps_to_not_configured(mock_openai_cls):
    from openai import AuthenticationError

    mock_client = MagicMock()
    mock_openai_cls.return_value = mock_client
    mock_client.chat.completions.create.side_effect = AuthenticationError(
        "invalid", response=MagicMock(status_code=401), body=None
    )

    with patch("app.services.agent.llm_client.get_settings") as gs:
        settings = MagicMock()
        settings.openai_api_key = "bad-key"
        settings.openai_model = "gpt-4o"
        settings.openai_base_url = None
        settings.openai_timeout_seconds = 30
        gs.return_value = settings

        out = AgentLlmClient().chat([{"role": "user", "content": "hi"}])

    assert out["error"] == "not_configured"
    assert out["choices"] == []


def test_agent_llm_client_disabled_without_api_key():
    with patch("app.services.agent.llm_client.get_settings") as gs:
        settings = MagicMock()
        settings.openai_api_key = ""
        settings.openai_model = "gpt-4o"
        settings.openai_base_url = None
        settings.openai_timeout_seconds = 30
        gs.return_value = settings

        client = AgentLlmClient()
        assert client.enabled is False
        assert client.chat([], tools=[]).get("error") == "not_configured"


def test_orchestrator_missing_key_does_not_call_tools():
    db = MagicMock()
    ctx = MagicMock()
    ctx.tenant_id = 1
    ctx.user_id = 2
    ctx.role = "Store Manager"

    with patch("app.services.agent.orchestrator.AgentLlmClient") as mock_cls:
        mock_cls.return_value.enabled = False
        with patch("app.services.agent.orchestrator.get_or_create_conversation") as mock_conv:
            conv = MagicMock()
            conv.external_id = "c1"
            mock_conv.return_value = conv
            with patch("app.services.agent.orchestrator.append_message"):
                with patch("app.services.agent.orchestrator.recent_messages_for_llm", return_value=[]):
                    with patch("app.services.agent.orchestrator.log_agent_event"):
                        with patch(
                            "app.services.agent.orchestrator.execute_tool_async"
                        ) as mock_tool:
                            resp = asyncio.run(run_agent_chat(db, ctx, "hello", None))

    mock_tool.assert_not_called()
    assert "not configured" in resp.answer_text.lower()
    assert "openai" in resp.answer_text.lower()
