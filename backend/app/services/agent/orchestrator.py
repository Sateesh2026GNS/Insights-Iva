"""AI Operator Agent orchestration — tool-calling over live ERP data."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.services.agent.audit import log_agent_event, serialize_tool_params
from app.services.agent.confirmation import create_confirmation
from app.services.agent.context import AgentContext
from app.services.agent.conversation import append_message, get_or_create_conversation, recent_messages_for_llm
from app.services.agent.tool_registry import (
    ROLE_OPERATOR,
    ROLE_SALES_MANAGER,
    ROLE_STORE_MANAGER,
    agent_role_names,
    user_may_use_tool_name,
)
from app.services.agent.tool_models import ConfirmationRequired, ToolResultBase
from app.services.agent.tools import (
    ToolTimeoutError,
    _WRITE_EXECUTE,
    execute_tool_async,
    openai_tool_definitions,
)
from app.services.agent.llm_client import AgentLlmClient
from app.services.agent.module_quick_replies import try_module_quick_reply
from app.services.agent.operator_localize import localize_operator_text as localize_agent_text
from app.services.agent.operator_responses import try_operator_structured_reply

logger = logging.getLogger(__name__)

SYSTEM_PROMPT_VERSION = "v1"
MAX_TOOL_ROUNDS = 3

def _system_prompt_for(ctx: AgentContext) -> str:
    roles = agent_role_names(ctx)
    role_label = ", ".join(sorted(roles)) if roles else ctx.role
    if ROLE_OPERATOR in roles and len(roles) == 1:
        persona = "Operator Assistant"
    elif ROLE_SALES_MANAGER in roles and ROLE_STORE_MANAGER not in roles:
        persona = "Sales Manager Assistant"
    elif ROLE_STORE_MANAGER in roles:
        persona = "Store Operations Assistant"
    else:
        persona = "Insights Iva Assistant"
    return f"""You are the Insights Iva {persona} ({SYSTEM_PROMPT_VERSION}).

Authenticated role(s): {role_label}. Only use tools provided in this request — they are already limited to what this user may access.
You may only answer using data returned by tool calls in this conversation turn. Never state a number, date, or status that did not come from a tool result.
If no tool returns relevant data, say so plainly — do not guess or extrapolate.
Never call a write tool without the user having confirmed in this conversation (sales/store write tools require confirmation).

Accept mixed Telugu/English input. Preserve identifiers (order numbers, job cards, GRN, customer names) exactly as stored — never translate or transliterate identifiers.
Respond in the same language the user's message was written in.

For simple factual questions (counts, today's totals, a single work order status), give a short direct answer from tool data only.
Evidence-based insights are allowed only when derived from tool results (e.g. delayed count > 0).
Do not add unsolicited maintenance/training advice or invented causes.
Never treat a failed or empty tool response as zero — say you could not retrieve the data.
Respond in the same language the user used (English, Telugu, Hindi, or mixed).

When a tool times out, tell the user data fetch timed out and they should try again.
Tenant scope: never request or assume another company's data.
"""


class AgentCard(BaseModel):
    tool: str
    source_report_key: str
    report_title: str | None = None
    rows: list[dict[str, Any]] = Field(default_factory=list)
    columns: list[dict[str, Any]] = Field(default_factory=list)
    truncated: bool = False
    total_count: int = 0
    generated_at: str
    scope_label: str | None = None


class SuggestedAction(BaseModel):
    label: str
    action_type: str
    payload: dict[str, Any] = Field(default_factory=dict)


class RequiresConfirmation(BaseModel):
    confirmation_token: str
    summary: str
    tool_name: str
    payload: dict[str, Any]


class AgentChatResponse(BaseModel):
    answer_text: str
    conversation_id: str
    cards: list[AgentCard] = Field(default_factory=list)
    suggested_actions: list[SuggestedAction] = Field(default_factory=list)
    requires_confirmation: RequiresConfirmation | None = None
    insight: str | None = None
    printable: bool = False
    report_title: str | None = None
    export_text: str | None = None


def _warehouse_scope_label(ctx: AgentContext) -> str | None:
    n = len(ctx.allowed_warehouse_ids)
    if n == 0:
        return None
    return "1 warehouse" if n == 1 else f"{n} warehouses"


def _tool_result_to_card(
    tool_name: str,
    result: Any,
    *,
    scope_label: str | None = None,
) -> AgentCard | None:
    if isinstance(result, dict) and result.get("error"):
        return None
    if isinstance(result, ConfirmationRequired):
        return None
    if isinstance(result, ToolResultBase):
        if not result.rows:
            return None
        return AgentCard(
            tool=tool_name,
            source_report_key=result.source_report_key,
            report_title=result.report_title,
            rows=result.rows,
            columns=result.columns or [],
            truncated=result.truncated,
            total_count=result.total_count,
            generated_at=result.generated_at,
            scope_label=scope_label,
        )
    if isinstance(result, dict) and "rows" in result:
        if not result.get("rows"):
            return None
        return AgentCard(
            tool=tool_name,
            source_report_key=result.get("source_report_key", ""),
            report_title=result.get("report_title"),
            rows=result.get("rows") or [],
            columns=result.get("columns") or [],
            truncated=bool(result.get("truncated")),
            total_count=int(result.get("total_count") or 0),
            generated_at=result.get("generated_at") or "",
            scope_label=scope_label,
        )
    return None


def _result_row_meta(result: Any) -> tuple[int | None, bool | None]:
    if isinstance(result, ToolResultBase):
        return len(result.rows), result.truncated
    if isinstance(result, dict) and "rows" in result:
        rows = result.get("rows") or []
        return len(rows), bool(result.get("truncated"))
    return None, None


async def run_agent_chat(
    db: Session,
    ctx: AgentContext,
    message: str,
    conversation_id: str | None,
) -> AgentChatResponse:
    started = time.perf_counter()
    user_message = (message or "").strip()
    conv = get_or_create_conversation(db, ctx.tenant_id, ctx.user_id, conversation_id)
    if user_message:
        append_message(db, conv, "user", user_message)

    structured = try_module_quick_reply(db, ctx, user_message) or try_operator_structured_reply(
        db, ctx, user_message
    )
    if structured:
        answer_text, insight = localize_agent_text(
            user_message, structured.answer_text, structured.insight
        )
        export_parts = [answer_text]
        if insight:
            export_parts.extend(["", "Insight:", insight])
        export_text = "\n".join(export_parts)
        append_message(
            db,
            conv,
            "assistant",
            answer_text,
            payload={
                "cards": [],
                "insight": insight,
                "printable": structured.printable,
                "report_title": structured.report_title,
                "export_text": export_text,
            },
        )
        return AgentChatResponse(
            answer_text=answer_text,
            conversation_id=conv.external_id,
            cards=[],
            suggested_actions=[],
            requires_confirmation=None,
            insight=insight,
            printable=structured.printable,
            report_title=structured.report_title,
            export_text=export_text,
        )

    cards: list[AgentCard] = []
    requires_conf: RequiresConfirmation | None = None
    answer_text = ""

    llm = AgentLlmClient()
    history = recent_messages_for_llm(db, conv)
    messages: list[dict[str, Any]] = [{"role": "system", "content": _system_prompt_for(ctx)}]
    messages.extend(history)
    if not history or history[-1].get("content") != user_message:
        messages.append({"role": "user", "content": user_message})

    tools = openai_tool_definitions(ctx)

    if not llm.enabled:
        answer_text = (
            "The AI agent is not configured (OpenAI API key missing). "
            "Please contact your administrator."
        )
    else:
        _round = 0
        for _round in range(MAX_TOOL_ROUNDS):
            response = llm.chat(messages, tools=tools)
            err = response.get("error")
            if err == "not_configured":
                answer_text = (
                    "The AI agent is not configured (OpenAI API key missing). "
                    "Please contact your administrator."
                )
                break
            if err == "rate_limit":
                answer_text = (
                    "The language model provider rate limit was reached. "
                    "Please wait a moment and try again."
                )
                break
            if err == "timeout":
                answer_text = "The language model request timed out. Please try again."
                break
            if err:
                detail = response.get("detail")
                if detail and not get_settings().is_production:
                    logger.warning("Agent LLM error (%s): %s", err, detail)
                answer_text = "I could not reach the language model. Please try again."
                break

            choices = response.get("choices") or []
            if not choices:
                answer_text = "I could not reach the language model. Please try again."
                break

            msg = choices[0].get("message") or {}
            tool_calls = msg.get("tool_calls") or []

            if not tool_calls:
                answer_text = (msg.get("content") or "").strip()
                break

            messages.append(msg)
            stop_round = False
            for tc in tool_calls:
                fn = tc.get("function") or {}
                tool_name = fn.get("name") or ""
                try:
                    args = json.loads(fn.get("arguments") or "{}")
                except json.JSONDecodeError:
                    args = {}

                tool_started = time.perf_counter()
                try:
                    result = await execute_tool_async(db, ctx, tool_name, args)
                except ToolTimeoutError:
                    result = {
                        "error": "timeout",
                        "message": "Data fetch timed out, try again.",
                    }

                latency = int((time.perf_counter() - tool_started) * 1000)
                row_count, truncated = _result_row_meta(result)

                log_agent_event(
                    db,
                    tenant_id=ctx.tenant_id,
                    user_id=ctx.user_id,
                    role=ctx.role,
                    user_message=user_message,
                    tool_name=tool_name,
                    tool_params=serialize_tool_params(args),
                    result_row_count=row_count,
                    result_truncated=truncated,
                    response_text=None,
                    latency_ms=latency,
                )

                if isinstance(result, ConfirmationRequired):
                    token = create_confirmation(
                        tenant_id=ctx.tenant_id,
                        user_id=ctx.user_id,
                        tool_name=result.tool_name,
                        payload=result.payload,
                        summary=result.summary,
                    )
                    requires_conf = RequiresConfirmation(
                        confirmation_token=token,
                        summary=result.summary,
                        tool_name=result.tool_name,
                        payload=result.payload,
                    )
                    answer_text = result.summary
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "content": json.dumps(
                                {"status": "confirmation_required", "summary": result.summary},
                                default=str,
                            ),
                        }
                    )
                    stop_round = True
                    break

                if isinstance(result, dict) and result.get("error"):
                    err = result.get("error")
                    if err == "timeout":
                        tool_content = result.get("message", "Data fetch timed out, try again.")
                    else:
                        tool_content = str(err)
                    messages.append(
                        {
                            "role": "tool",
                            "tool_call_id": tc.get("id"),
                            "content": json.dumps({"error": tool_content}, default=str),
                        }
                    )
                    continue

                card = _tool_result_to_card(
                    tool_name,
                    result,
                    scope_label=_warehouse_scope_label(ctx),
                )
                if card:
                    cards.append(card)

                if hasattr(result, "model_dump"):
                    payload = result.model_dump(mode="json")
                else:
                    payload = result
                messages.append(
                    {
                        "role": "tool",
                        "tool_call_id": tc.get("id"),
                        "content": json.dumps(payload, default=str),
                    }
                )

            if stop_round or requires_conf:
                break

        if not answer_text and not requires_conf:
            final = llm.chat(messages, tools=None)
            final_choices = final.get("choices") or []
            if final_choices:
                answer_text = (final_choices[0].get("message") or {}).get("content") or ""
            if not answer_text and cards:
                answer_text = "Here is the latest data from the system."
            elif not answer_text and _round >= MAX_TOOL_ROUNDS - 1:
                answer_text = (
                    "I gathered partial data within the tool limit. "
                    "Please ask a more specific follow-up if needed."
                )

    if not answer_text:
        if cards:
            answer_text = "Here is the latest data from the system."
        elif requires_conf:
            answer_text = requires_conf.summary
        else:
            answer_text = "I could not find matching data for your question."

    total_ms = int((time.perf_counter() - started) * 1000)
    log_agent_event(
        db,
        tenant_id=ctx.tenant_id,
        user_id=ctx.user_id,
        role=ctx.role,
        user_message=user_message,
        tool_name=None,
        tool_params=None,
        result_row_count=sum(len(c.rows) for c in cards),
        result_truncated=any(c.truncated for c in cards),
        response_text=answer_text,
        latency_ms=total_ms,
    )

    append_message(
        db,
        conv,
        "assistant",
        answer_text,
        payload={
            "cards": [c.model_dump(mode="json") for c in cards],
            "requires_confirmation": (
                requires_conf.model_dump(mode="json") if requires_conf else None
            ),
        },
    )

    return AgentChatResponse(
        answer_text=answer_text,
        conversation_id=conv.external_id,
        cards=cards,
        suggested_actions=[],
        requires_confirmation=requires_conf,
        insight=None,
        printable=bool(cards),
        report_title=cards[0].report_title if cards else None,
        export_text=answer_text if cards else None,
    )


def execute_confirmed_write(
    db: Session,
    ctx: AgentContext,
    tool_name: str,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Phase 2 — execute write after confirmation (feature-flagged)."""
    if not get_settings().agent_write_tools_enabled:
        return {"success": False, "error": "Write tools are disabled."}
    if not user_may_use_tool_name(ctx, tool_name):
        return {"success": False, "error": "Permission denied for write action."}
    if tool_name in _WRITE_EXECUTE:
        return _WRITE_EXECUTE[tool_name](db, ctx, payload)
    # TODO: wire create_material_issue → submit_store_material_issue / purchase indent service
    return {
        "success": False,
        "error": (
            f"Write tool '{tool_name}' is scaffolded but not yet connected to production services."
        ),
    }
