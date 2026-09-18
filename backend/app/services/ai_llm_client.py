"""OpenAI-compatible LLM client with optional streaming."""

from __future__ import annotations

import json
import logging
from typing import Any, Generator

import httpx

from app.core.config import get_settings
from app.utils.openai_settings import normalize_openai_base_url

logger = logging.getLogger(__name__)

_DEFAULT_OPENAI_V1 = "https://api.openai.com/v1"


class LlmClient:
    def __init__(self) -> None:
        s = get_settings()
        self.api_key = s.openai_api_key
        base = normalize_openai_base_url(s.openai_base_url) or _DEFAULT_OPENAI_V1
        self.base_url = base.rstrip("/")
        self.model = s.openai_model
        self.timeout = s.openai_timeout_seconds

    @property
    def enabled(self) -> bool:
        return bool(self.api_key and self.base_url)

    def chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
        temperature: float = 0.2,
    ) -> dict:
        if not self.enabled:
            return {"choices": []}

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                resp = client.post(f"{self.base_url}/chat/completions", json=payload, headers=headers)
                resp.raise_for_status()
                return resp.json()
        except httpx.HTTPStatusError as exc:
            body = (exc.response.text or "")[:800] if exc.response is not None else ""
            logger.warning(
                "LLM HTTP %s: %s",
                exc.response.status_code if exc.response is not None else "?",
                body or exc,
            )
            return {"choices": [], "error": "api_error", "detail": body or str(exc)}
        except Exception as exc:
            logger.exception("LLM request failed")
            return {"choices": [], "error": "api_error", "detail": str(exc)}

    def stream_chat(
        self,
        messages: list[dict],
        tools: list[dict] | None = None,
    ) -> Generator[str, None, None]:
        if not self.enabled:
            yield json.dumps({"type": "error", "message": "LLM not configured"})
            return

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
            "stream": True,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = "auto"

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

        try:
            with httpx.Client(timeout=self.timeout) as client:
                with client.stream(
                    "POST",
                    f"{self.base_url}/chat/completions",
                    json=payload,
                    headers=headers,
                ) as resp:
                    resp.raise_for_status()
                    for line in resp.iter_lines():
                        if not line or not line.startswith("data: "):
                            continue
                        data = line[6:].strip()
                        if data == "[DONE]":
                            break
                        try:
                            chunk = json.loads(data)
                            delta = chunk.get("choices", [{}])[0].get("delta", {})
                            if delta.get("content"):
                                yield json.dumps({"type": "token", "content": delta["content"]})
                        except json.JSONDecodeError:
                            continue
        except Exception as exc:
            logger.warning("LLM stream failed: %s", exc)
            yield json.dumps({"type": "error", "message": str(exc)})
