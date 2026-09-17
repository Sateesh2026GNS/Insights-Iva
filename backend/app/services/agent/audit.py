from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.ai_agent import AiAgentLog


def log_agent_event(
    db: Session,
    *,
    tenant_id: int,
    user_id: int,
    role: str | None,
    user_message: str | None,
    tool_name: str | None,
    tool_params: dict[str, Any] | None,
    result_row_count: int | None,
    result_truncated: bool | None,
    response_text: str | None,
    latency_ms: int | None,
) -> None:
    row = AiAgentLog(
        tenant_id=tenant_id,
        user_id=user_id,
        role=role,
        user_message=user_message,
        tool_name=tool_name,
        tool_params=tool_params,
        result_row_count=result_row_count,
        result_truncated=result_truncated,
        response_text=response_text,
        latency_ms=latency_ms,
    )
    db.add(row)
    db.commit()


def serialize_tool_params(params: Any) -> dict[str, Any] | None:
    if params is None:
        return None
    if isinstance(params, dict):
        return params
    if hasattr(params, "model_dump"):
        return params.model_dump(mode="json")
    try:
        return json.loads(json.dumps(params, default=str))
    except Exception:
        return {"raw": str(params)}
