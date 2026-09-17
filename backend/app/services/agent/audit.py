from __future__ import annotations

import json
from typing import Any

from sqlalchemy.orm import Session

from app.models.ai_agent import AiAgentLog
from app.services.agent.tool_registry import extract_sensitive_targets, get_tool_definition


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
    tool_sensitivity: str | None = None,
    sensitive_targets: dict[str, Any] | None = None,
) -> None:
    if tool_name and tool_params is not None:
        defn = get_tool_definition(tool_name)
        if defn and defn.sensitivity == "elevated":
            tool_sensitivity = defn.sensitivity
            sensitive_targets = sensitive_targets or extract_sensitive_targets(tool_name, tool_params)
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
        tool_sensitivity=tool_sensitivity,
        sensitive_targets=sensitive_targets,
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
