"""Direct quick-action replies for module summary tools (no LLM required)."""

from __future__ import annotations

import re

from sqlalchemy.orm import Session

from app.services.agent.context import AgentContext
from app.services.agent.module_agent_tools import (
    EmptyInput,
    get_accounts_summary,
    get_business_summary,
    get_hr_summary,
    get_quality_summary,
)
from app.services.agent.operator_responses import OperatorReplyResult, strip_page_context
from app.services.agent.tool_registry import (
    ROLE_ACCOUNTANT,
    ROLE_ADMIN,
    ROLE_HR_MANAGER,
    ROLE_QUALITY_CONTROL,
    agent_role_names,
)


def _format_summary_rows(rows: list[dict]) -> str:
    return "\n".join(f"{r.get('metric', '?')}: {r.get('value', '—')}" for r in rows)


def try_module_quick_reply(db: Session, ctx: AgentContext, user_message: str) -> OperatorReplyResult | None:
    text = strip_page_context(user_message).strip().lower()
    text = re.sub(r"\s+", " ", text)
    roles = agent_role_names(ctx)

    if text in ("business summary", "give me business summary", "today business summary"):
        if ROLE_ADMIN not in roles:
            return None
        res = get_business_summary(db, ctx, EmptyInput())
        body = "Business Summary\n\n" + _format_summary_rows(res.rows)
        return OperatorReplyResult(
            answer_text=body,
            printable=True,
            report_title="Business summary",
        )

    if text in ("quality summary", "qc summary", "quality summary report"):
        if ROLE_QUALITY_CONTROL not in roles and ROLE_ADMIN not in roles:
            return None
        res = get_quality_summary(db, ctx, EmptyInput())
        return OperatorReplyResult(
            answer_text="Quality Summary\n\n" + _format_summary_rows(res.rows),
            printable=True,
            report_title="Quality summary",
        )

    if text in ("hr summary", "human resources summary"):
        if ROLE_HR_MANAGER not in roles and ROLE_ADMIN not in roles:
            return None
        res = get_hr_summary(db, ctx, EmptyInput())
        return OperatorReplyResult(
            answer_text="HR Summary\n\n" + _format_summary_rows(res.rows),
            printable=True,
            report_title="HR summary",
        )

    if text in ("accounts summary", "accounting summary"):
        if ROLE_ACCOUNTANT not in roles and ROLE_ADMIN not in roles:
            return None
        res = get_accounts_summary(db, ctx, EmptyInput())
        return OperatorReplyResult(
            answer_text="Accounts Summary\n\n" + _format_summary_rows(res.rows),
            printable=True,
            report_title="Accounts summary",
        )

    return None
