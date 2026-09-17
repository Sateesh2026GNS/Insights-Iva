from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgentChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None


class AgentConfirmRequest(BaseModel):
    confirmation_token: str
    confirmed: bool


class AgentLogItem(BaseModel):
    id: int
    tenant_id: int
    user_id: int
    role: str | None
    user_message: str | None
    tool_name: str | None
    tool_params: dict[str, Any] | None
    result_row_count: int | None
    result_truncated: bool | None
    response_text: str | None
    latency_ms: int | None
    created_at: str | None
