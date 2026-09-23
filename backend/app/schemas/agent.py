from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgentChatRequest(BaseModel):
    message: str
    conversation_id: str | None = None
    image_base64: str | None = Field(
        None,
        description="Optional screenshot image (base64, max ~4MB decoded).",
    )
    image_media_type: str | None = Field(
        "image/png",
        description="MIME type for image_base64 (image/png, image/jpeg, image/webp).",
    )


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
