"""OpenAI Chat Completions client for the Store Operator Agent."""

from __future__ import annotations

import json
import logging
from typing import Any

from openai import APIConnectionError, APITimeoutError, AuthenticationError, OpenAI, RateLimitError

from app.core.config import get_settings
from app.services.agent.tools import READ_TOOL_NAMES, openai_tool_definitions

logger = logging.getLogger(__name__)

# Uses OpenAI Python SDK `client.chat.completions.create` (Chat Completions API).


def agent_tool_schemas() -> list[dict[str, Any]]:
    """OpenAI function-calling tool definitions (read + optional write tools)."""
    return openai_tool_definitions()


def read_tool_schemas() -> list[dict[str, Any]]:
    """Schemas for the five read-only agent tools."""
    names = set(READ_TOOL_NAMES)
    return [t for t in agent_tool_schemas() if t.get("function", {}).get("name") in names]


def _assistant_message_to_dict(message: Any) -> dict[str, Any]:
    out: dict[str, Any] = {"role": "assistant", "content": message.content or ""}
    if message.tool_calls:
        out["tool_calls"] = [
            {
                "id": tc.id,
                "type": "function",
                "function": {
                    "name": tc.function.name,
                    "arguments": tc.function.arguments or "{}",
                },
            }
            for tc in message.tool_calls
        ]
    return out


class AgentLlmClient:
    """Thin wrapper around OpenAI chat completions for agent orchestration."""

    def __init__(self) -> None:
        settings = get_settings()
        self._api_key = (settings.openai_api_key or "").strip()
        self._model = settings.openai_model
        self._timeout = float(settings.openai_timeout_seconds)
        base = settings.openai_base_url
        self._client: OpenAI | None = None
        if self._api_key:
            kwargs: dict[str, Any] = {"api_key": self._api_key, "timeout": self._timeout}
            if base:
                kwargs["base_url"] = base.rstrip("/")
            self._client = OpenAI(**kwargs)

    @property
    def enabled(self) -> bool:
        return bool(self._api_key and self._client)

    def chat(
        self,
        messages: list[dict[str, Any]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.2,
    ) -> dict[str, Any]:
        """
        Return OpenAI-compatible JSON: {choices: [{message: ...}], error?: str}.
        Errors: not_configured | rate_limit | timeout | api_error
        """
        if not self.enabled:
            return {"choices": [], "error": "not_configured"}

        try:
            kwargs: dict[str, Any] = {
                "model": self._model,
                "messages": messages,
                "temperature": temperature,
            }
            if tools:
                kwargs["tools"] = tools
                kwargs["tool_choice"] = "auto"

            completion = self._client.chat.completions.create(**kwargs)
            choice = completion.choices[0] if completion.choices else None
            if not choice:
                return {"choices": []}
            return {
                "choices": [
                    {"message": _assistant_message_to_dict(choice.message)},
                ],
            }
        except AuthenticationError as exc:
            logger.warning("OpenAI authentication failed: %s", exc)
            return {"choices": [], "error": "not_configured"}
        except RateLimitError as exc:
            logger.warning("OpenAI rate limit: %s", exc)
            return {"choices": [], "error": "rate_limit"}
        except APITimeoutError as exc:
            logger.warning("OpenAI timeout: %s", exc)
            return {"choices": [], "error": "timeout"}
        except APIConnectionError as exc:
            logger.warning("OpenAI connection error: %s", exc)
            return {"choices": [], "error": "api_error", "detail": str(exc)}
        except Exception as exc:
            logger.warning("OpenAI chat failed: %s", exc)
            return {"choices": [], "error": "api_error", "detail": str(exc)}
