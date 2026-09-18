"""Operator role tools — bridge legacy function_registry into the shared agent registry."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.llm.function_registry import TOOL_DEFINITIONS, execute_tool, format_tool_result
from app.services.agent.context import AgentContext
from app.services.agent.tool_registry import (
    ROLE_ADMIN,
    ROLE_OPERATOR,
    ROLE_PRODUCTION_MANAGER,
    AgentToolDefinition,
    register_tool,
)

OPERATOR_ROLES = frozenset({ROLE_OPERATOR, ROLE_ADMIN})
PRODUCTION_AGENT_ROLES = frozenset({ROLE_OPERATOR, ROLE_PRODUCTION_MANAGER, ROLE_ADMIN})

# Operator mutations from the legacy assistant (no confirmation card — same as /ai/chat).
_OPERATOR_WRITE_TOOL_NAMES = frozenset(
    {
        "clock_in",
        "clock_out",
        "update_production_progress",
        "report_machine_breakdown",
    }
)


def execute_operator_tool(
    db: Session,
    ctx: AgentContext,
    tool_name: str,
    args: dict[str, Any],
) -> dict[str, Any]:
    """Run OperatorService-backed tool; return JSON-safe payload for the orchestrator."""
    raw = execute_tool(db, ctx.user, tool_name, args or {})
    summary = format_tool_result(tool_name, raw)
    out: dict[str, Any] = {
        "success": bool(raw.get("success", True)) if isinstance(raw, dict) else True,
        "summary": summary,
        "data": raw,
    }
    if isinstance(raw, dict) and raw.get("navigation"):
        out["navigation"] = raw["navigation"]
    if isinstance(raw, dict) and raw.get("error"):
        out["error"] = raw["error"]
    return out


def register_operator_tools() -> None:
    """Register legacy TOOL_DEFINITIONS — production tools for PM/Operator/Admin; exclusives for Operator."""
    for entry in TOOL_DEFINITIONS:
        fn = entry.get("function") or {}
        name = fn.get("name")
        if not name:
            continue
        roles = OPERATOR_ROLES if name in _OPERATOR_WRITE_TOOL_NAMES else PRODUCTION_AGENT_ROLES
        register_tool(
            AgentToolDefinition(
                name=name,
                description=(fn.get("description") or name).strip(),
                parameters_schema=fn.get("parameters") or {"type": "object", "properties": {}},
                allowed_roles=roles,
                kind="read",
            )
        )
