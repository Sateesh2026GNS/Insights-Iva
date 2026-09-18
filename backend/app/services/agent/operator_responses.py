"""Operator AI — factual replies, reports, evidence-based insights, zero-state safety."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from sqlalchemy.orm import Session

from app.llm.function_registry import execute_tool
from app.llm.intent_detector import detect_intent
from app.models.user import User
from app.services.agent.context import AgentContext
from app.services.agent.tool_registry import (
    ROLE_OPERATOR,
    ROLE_SALES_MANAGER,
    ROLE_STORE_MANAGER,
    agent_role_names,
)
from app.services.work_order_service import get_work_order_summary

_RE_CONTEXT = re.compile(r"^\[Context:[^\]]*\]\s*", re.IGNORECASE | re.MULTILINE)

_SIMPLE_TOTAL_WO = re.compile(
    r"(?:^|\b)(?:total|how\s+many|count)\b.*\bwork\s*orders?\b"
    r"|(?:^|\b)work\s*orders?\b.*\b(?:total|count|how\s+many|enni|enti|anni|unnayi|kitne|hain|hai)\b"
    r"|[\u0C00-\u0C7F].*work\s*orders?|[\u0900-\u097F].*work\s*orders?",
    re.IGNORECASE,
)
_SIMPLE_TODAY_WO = re.compile(
    r"today(?:'?s?)?\s+work\s*orders?|work\s*orders?\s+(?:for\s+)?today"
    r"|today\s+work\s*orders?\s*(?:enni|enti|count|how\s+many|kitne)"
    r"|(?:aaj|ఈరోజు).*(?:work\s*orders?|వర్క్)",
    re.IGNORECASE,
)
_SIMPLE_TODAY_PRODUCTION = re.compile(
    r"today(?:'?s?)?\s+production|production\s+(?:for\s+)?today|today\s+production\s+entha"
    r"|(?:aaj|ఈరోజు).*(?:production|ప్రొడక్షన్)",
    re.IGNORECASE,
)
_REPORT_WO_STATS = re.compile(
    r"\bwork\s*order\s*(?:stats|statistics|report|summary)\b"
    r"|comprehensive\s+work\s*order|detailed\s+work\s*order\s*report",
    re.IGNORECASE,
)
_ANALYSIS_HINT = re.compile(
    r"\b(?:why|recommend|should\s+i|what\s+should|advice|analy[sz]e|improve)\b",
    re.IGNORECASE,
)
_WO_STATUS_LOOKUP = re.compile(
    r"\b(?:status|progress|enti)\b.*\b(WO-[\w-]+)\b|\b(WO-[\w-]+)\b.*\b(?:status|progress|enti)\b",
    re.IGNORECASE,
)
_LIST_MY_WO = re.compile(
    r"\b(?:show|list|my)\s+(?:work\s*orders?|jobs?)\b",
    re.IGNORECASE,
)

RETRIEVE_FAIL = (
    "I couldn't retrieve the work order count right now.\nPlease try again."
)


@dataclass
class OperatorReplyResult:
    answer_text: str
    insight: str | None = None
    printable: bool = False
    report_title: str | None = None

    @property
    def export_text(self) -> str:
        parts = [self.answer_text]
        if self.insight:
            parts.extend(["", "Insight:", self.insight])
        return "\n".join(parts)


def strip_page_context(message: str) -> str:
    return _RE_CONTEXT.sub("", (message or "").strip()).strip()


def _operator_only(ctx: AgentContext) -> bool:
    roles = agent_role_names(ctx)
    return (
        ROLE_OPERATOR in roles
        and ROLE_STORE_MANAGER not in roles
        and ROLE_SALES_MANAGER not in roles
    )


def wants_analysis(message: str) -> bool:
    return bool(_ANALYSIS_HINT.search(message or ""))


def is_simple_total_work_orders(message: str) -> bool:
    text = strip_page_context(message)
    if wants_analysis(text) or is_report_work_order_stats(text):
        return False
    if _SIMPLE_TOTAL_WO.search(text):
        return True
    intent = detect_intent(text)
    if intent and intent[0] in ("get_assigned_work_orders", "get_work_order_stats_deep"):
        if re.search(r"\b(?:stats|statistics|summary|overview|comprehensive|detailed|breakdown|report)\b", text, re.I):
            return False
        if intent[0] == "get_assigned_work_orders":
            return True
    return False


def is_simple_today_work_orders(message: str) -> bool:
    text = strip_page_context(message)
    if wants_analysis(text):
        return False
    if _SIMPLE_TODAY_WO.search(text):
        if re.search(r"\b(?:detail|list|show\s+all|each|every)\b", text, re.I):
            return False
        return True
    return False


def is_report_work_order_stats(message: str) -> bool:
    text = strip_page_context(message)
    return bool(_REPORT_WO_STATS.search(text))


def _insight_from_summary(summary: Any) -> str | None:
    delayed = int(getattr(summary, "delayed_orders", 0) or 0)
    if delayed > 0:
        return (
            f"{delayed} work order(s) are currently delayed. "
            "Review their production status and assigned resources."
        )
    return None


def _insight_from_stats_dict(s: dict) -> str | None:
    delayed = int(s.get("delayed", 0) or 0)
    if delayed > 0:
        return (
            f"{delayed} work order(s) are currently delayed. "
            "Review their production status and assigned resources."
        )
    high_pri = int(s.get("high_priority", 0) or 0)
    if high_pri > 0 and delayed == 0:
        return f"{high_pri} work order(s) are marked high priority."
    return None


def format_work_order_summary_text(summary: Any, *, zero_hint: str | None = None) -> str:
    total = int(getattr(summary, "total_work_orders", 0) or 0)
    planned = int(getattr(summary, "planned_orders", 0) or 0)
    in_prog = int(getattr(summary, "in_progress_orders", 0) or 0)
    completed = int(getattr(summary, "completed_orders", 0) or 0)
    lines = [f"Total Work Orders: {total}"]
    if total > 0:
        lines.extend(
            [
                "",
                f"Planned: {planned}",
                f"In Progress: {in_prog}",
                f"Completed: {completed}",
            ]
        )
    elif zero_hint:
        lines.extend(["", zero_hint])
    return "\n".join(lines)


def _format_wo_stats_report(s: dict) -> str:
    return "\n".join(
        [
            "Work Order Statistics",
            "",
            f"Total: {int(s.get('total_work_orders', 0))}",
            f"Planned: {int(s.get('planned', 0))}",
            f"In Progress: {int(s.get('in_progress', 0))}",
            f"Completed: {int(s.get('completed', 0))}",
            f"Delayed: {int(s.get('delayed', 0))}",
            f"High Priority: {int(s.get('high_priority', 0))}",
            f"Paused: {int(s.get('paused', 0))}",
            f"Cancelled: {int(s.get('cancelled', 0))}",
        ]
    )


def try_operator_structured_reply(
    db: Session, ctx: AgentContext, user_message: str
) -> OperatorReplyResult | None:
    if not _operator_only(ctx):
        return None
    text = strip_page_context(user_message)
    if not text:
        return None

    user = db.get(User, ctx.user_id)
    if not user:
        return OperatorReplyResult(answer_text=RETRIEVE_FAIL)

    if is_report_work_order_stats(text):
        result = execute_tool(db, user, "get_work_order_stats_deep", {"query": text})
        if not result.get("success"):
            return OperatorReplyResult(answer_text=RETRIEVE_FAIL)
        s = result.get("summary") or {}
        body = _format_wo_stats_report(s)
        return OperatorReplyResult(
            answer_text=body,
            insight=_insight_from_stats_dict(s),
            printable=True,
            report_title="Work Order Statistics",
        )

    if is_simple_total_work_orders(text):
        try:
            summary = get_work_order_summary(db, ctx.tenant_id, user=user)
        except Exception:
            return OperatorReplyResult(answer_text=RETRIEVE_FAIL)
        hint = (
            "There are currently no work orders available for you."
            if summary.total_work_orders == 0
            else None
        )
        return OperatorReplyResult(
            answer_text=format_work_order_summary_text(summary, zero_hint=hint),
            insight=_insight_from_summary(summary),
            printable=False,
        )

    if is_simple_today_work_orders(text):
        result = execute_tool(db, user, "get_todays_work_orders", {})
        if not result.get("success"):
            return OperatorReplyResult(answer_text=RETRIEVE_FAIL)
        count = int(result.get("count") or len(result.get("work_orders") or []))
        if count == 0:
            return OperatorReplyResult(
                answer_text="Today's Work Orders: 0\n\nNo work orders are scheduled for you today.",
            )
        delayed = sum(
            1
            for wo in result.get("work_orders") or []
            if (wo.get("status") or "").lower() in ("delayed", "on_hold", "hold")
        )
        insight = (
            f"{delayed} of today's work order(s) are delayed."
            if delayed > 0
            else None
        )
        return OperatorReplyResult(
            answer_text=f"Today's Work Orders: {count}",
            insight=insight,
        )

    if _SIMPLE_TODAY_PRODUCTION.search(text):
        result = execute_tool(db, user, "get_todays_production", {})
        if not result.get("success"):
            return OperatorReplyResult(
                answer_text="I couldn't retrieve today's production right now.\nPlease try again.",
            )
        produced = int(result.get("todays_production", 0) or 0)
        target = int(result.get("todays_target", 0) or 0)
        lines = [f"Today's Production: {produced} units"]
        if target > 0:
            lines.append(f"Target: {target} units")
        return OperatorReplyResult(answer_text="\n".join(lines))

    if _LIST_MY_WO.search(text) and not wants_analysis(text):
        result = execute_tool(db, user, "get_assigned_work_orders", {})
        if not result.get("success"):
            return OperatorReplyResult(answer_text=RETRIEVE_FAIL)
        orders = result.get("work_orders") or []
        if not orders:
            return OperatorReplyResult(
                answer_text="No work orders are currently assigned to you.",
            )
        lines = ["Your work orders:", ""]
        for wo in orders[:15]:
            lines.append(
                f"- {wo.get('work_order_number', '?')} · {wo.get('status', '—')} · "
                f"{wo.get('product_name') or wo.get('product') or '—'}"
            )
        if len(orders) > 15:
            lines.append(f"\n… and {len(orders) - 15} more.")
        return OperatorReplyResult(answer_text="\n".join(lines), printable=len(orders) > 3)

    m = _WO_STATUS_LOOKUP.search(text)
    if m:
        wo_no = (m.group(1) or m.group(2) or "").upper()
        result = execute_tool(db, user, "get_work_order_by_number", {"work_order_number": wo_no})
        if not result.get("success"):
            return OperatorReplyResult(answer_text=RETRIEVE_FAIL)
        if not result.get("found"):
            return OperatorReplyResult(answer_text=f"Work order {wo_no} was not found in your scope.")
        wo = result.get("work_order") or {}
        status = wo.get("status") or "unknown"
        num = wo.get("work_order_number") or wo_no
        return OperatorReplyResult(answer_text=f"{num} status: {status}")

    return None


def try_operator_factual_reply(db: Session, ctx: AgentContext, user_message: str) -> str | None:
    """Backward-compatible string helper."""
    structured = try_operator_structured_reply(db, ctx, user_message)
    return structured.answer_text if structured else None


def legacy_concise_reply(tool_name: str, result: dict, user_message: str) -> str | None:
    text = strip_page_context(user_message)
    if wants_analysis(text):
        return None
    if not result.get("success"):
        if tool_name in ("get_work_order_stats_deep", "get_assigned_work_orders", "get_todays_work_orders"):
            return RETRIEVE_FAIL
        return None
    if tool_name == "get_work_order_stats_deep" and is_report_work_order_stats(text):
        s = result.get("summary") or {}
        return _format_wo_stats_report(s)
    if tool_name == "get_work_order_stats_deep" and is_simple_total_work_orders(text):
        s = result.get("summary") or {}
        total = int(s.get("total_work_orders", -1))
        if total < 0:
            return RETRIEVE_FAIL
        lines = [f"Total Work Orders: {total}"]
        if total > 0:
            lines += [
                "",
                f"Planned: {int(s.get('planned', 0))}",
                f"In Progress: {int(s.get('in_progress', 0))}",
                f"Completed: {int(s.get('completed', 0))}",
            ]
        else:
            lines += ["", "There are currently no work orders available for you."]
        return "\n".join(lines)
    if tool_name == "get_todays_work_orders" and is_simple_today_work_orders(text):
        count = int(result.get("count") or len(result.get("work_orders") or []))
        if count == 0:
            return "Today's Work Orders: 0\n\nNo work orders are scheduled for you today."
        return f"Today's Work Orders: {count}"
    if tool_name == "get_assigned_work_orders" and is_simple_total_work_orders(text):
        orders = result.get("work_orders") or []
        count = int(result.get("count") or len(orders))
        planned = in_prog = completed = 0
        for wo in orders:
            st = (wo.get("status") or "").lower()
            if st in ("completed", "closed", "done"):
                completed += 1
            elif st in ("in_progress", "running", "active"):
                in_prog += 1
            else:
                planned += 1
        lines = [f"Total Work Orders: {count}"]
        if count > 0:
            lines += ["", f"Planned: {planned}", f"In Progress: {in_prog}", f"Completed: {completed}"]
        else:
            lines += ["", "There are currently no work orders available for you."]
        return "\n".join(lines)
    return None
