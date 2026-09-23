"""Admin-only self-evaluation harness for the shared ERP AI assistant."""

from __future__ import annotations

import time
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.services.agent.context import AgentContext
from app.services.agent.tool_registry import user_may_use_tool_name
from app.services.agent.tools import execute_tool_async


@dataclass(frozen=True)
class AgentEvalCase:
    case_id: str
    description: str
    tool_name: str
    args: dict[str, Any]
    expect_error: bool = False
    expect_permission_denied: bool = False


DEFAULT_EVAL_CASES: tuple[AgentEvalCase, ...] = (
    AgentEvalCase(
        case_id="job_search_not_configured",
        description="Job search returns integration_not_configured",
        tool_name="search_job_opportunities",
        args={},
        expect_error=True,
    ),
    AgentEvalCase(
        case_id="weekly_report_sales_section",
        description="Weekly report uses sales hub for authorized users",
        tool_name="get_weekly_business_report",
        args={"days": 7},
    ),
    AgentEvalCase(
        case_id="forbidden_tool_name",
        description="Unknown tool denied",
        tool_name="__no_such_tool__",
        args={},
        expect_error=True,
    ),
)


async def run_agent_evaluation(db: Session, ctx: AgentContext) -> dict[str, Any]:
    results: list[dict[str, Any]] = []
    for case in DEFAULT_EVAL_CASES:
        started = time.perf_counter()
        outcome: dict[str, Any] = {
            "case_id": case.case_id,
            "description": case.description,
            "tool_name": case.tool_name,
            "authorized": user_may_use_tool_name(ctx, case.tool_name),
        }
        if case.tool_name != "__no_such_tool__" and not outcome["authorized"]:
            outcome["status"] = "skipped"
            outcome["reason"] = "Tool not permitted for role."
            results.append(outcome)
            continue
        try:
            raw = await execute_tool_async(db, ctx, case.tool_name, case.args)
        except Exception as exc:
            raw = {"error": str(exc)}
        latency_ms = int((time.perf_counter() - started) * 1000)
        err = isinstance(raw, dict) and raw.get("error")
        outcome["latency_ms"] = latency_ms
        outcome["actual"] = raw if isinstance(raw, dict) else str(type(raw).__name__)
        if case.expect_permission_denied:
            outcome["status"] = "pass" if err and "permit" in str(err).lower() else "fail"
        elif case.expect_error:
            outcome["status"] = "pass" if err else "fail"
        else:
            outcome["status"] = "pass" if not err else "fail"
        results.append(outcome)
    passed = sum(1 for r in results if r.get("status") == "pass")
    return {
        "summary": {"total": len(results), "passed": passed, "failed": len(results) - passed},
        "results": results,
    }
