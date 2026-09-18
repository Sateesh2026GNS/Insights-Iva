"""AI Operator Assistant — full ChatGPT-like orchestration."""

from __future__ import annotations

import json
import logging
import time
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.ai_conversation import AiConversation, AiMessage
from app.models.user import User
from app.llm.function_registry import TOOL_DEFINITIONS, execute_tool, format_tool_result
from app.llm.intent_detector import detect_intent
from app.llm.llm_service import LlmClient
from app.services.operator_service import OperatorService
from app.llm.prompt_templates import (
    ACCESS_RESTRICTED_MESSAGE,
    API_FAIL_REPLY,
    OUT_OF_SCOPE_REPLY,
    SUGGESTIONS,
    SYSTEM_PROMPT,
)

logger = logging.getLogger(__name__)

_cache: dict[str, tuple[float, Any]] = {}
CACHE_TTL = 60  # seconds

# All 10 deep-intelligence tools — these always get an LLM narrative pass
DEEP_TOOLS = {
    # Original 10
    "get_machine_deep_status",
    "get_work_order_deep",
    "get_batch_deep",
    "get_production_plan_deep",
    "get_shopfloor_deep",
    "get_attendance_deep",
    "get_production_overview_deep",
    "get_schedule_deep",
    "get_mrp_deep",
    "get_assigned_tasks_deep",
    # 6 new domain tools
    "get_product_overview_deep",
    "get_work_order_stats_deep",
    "get_production_schedule_stats_deep",
    "get_machine_allocation_deep",
    "get_batch_summary_deep",
    "get_machine_status_deep",
}

# Narrative instruction — forces deep ChatGPT-style answer for EVERY tool result
NARRATE_INSTRUCTION = """
Using the real ERP data provided above, write a DETAILED, COMPREHENSIVE answer
exactly like ChatGPT would — follow this strict format:

1. START with a one-line bold summary (e.g. "🏭 Here is the full Machine Status Report:")
2. Use BOLD SECTION HEADERS with emojis for every section:
   📊 Summary | 🏭 Machines | 📋 Work Orders | 👷 Manpower | ⏱ Time Analysis
   📦 Products | 🔧 Allocation | 📅 Schedule | 🔩 MRP | 📈 Production
   ⚙️ Performance | ✅ Status | 🔴 Alerts
3. Use bullet points (- **Label:** value) for EVERY field in the data
4. Use emojis before every status: 🟢 Running, 🔵 Planned, 🟡 Idle,
   🔴 Delayed/Breakdown, ✅ Completed, ⏸️ Paused, ❌ Cancelled, ⚫ Offline
5. For counts/numbers use: **bold** with units (e.g. **312 units**, **62.4%**)
6. Show ALL machines / work orders / batches individually — not just totals
7. Do NOT add unsolicited recommendations, "Insight" sections, or generic advice.
   Only include ⚠️ **Alert** when tool data shows a concrete issue (e.g. delayed count > 0).
8. NEVER skip any field — if data has it, show it
9. Format numbers with commas for thousands (e.g. 1,250 units)
10. Always show progress bars as percentage (e.g. Progress: **62.4%** ████░░)

IMPORTANT: Stay factual and structured — no editorial commentary beyond the data.
"""


# ── Access Guard ───────────────────────────────────────────────────────────────

def should_restrict_operator_message(message: str) -> str | None:
    text = (message or "").strip().lower()
    if not text:
        return None

    blocked = (
        "finance", "sales", "admin", "payroll", "salary",
        "gst", "profit", "invoice", "vendor", "recruit", "expense",
    )
    # Always allow quality/QC in context of batch, production, machine inspection
    if any(t in text for t in ("quality", "qc")) and any(
        t in text for t in ("batch", "production", "inspect", "machine", "yield", "scrap", "check")
    ):
        pass
    elif any(t in text for t in ("quality", "qc", "account")):
        return ACCESS_RESTRICTED_MESSAGE

    if "maintenance" in text:
        return None  # Machine maintenance is allowed

    if any(t in text for t in blocked):
        return ACCESS_RESTRICTED_MESSAGE

    allowed = (
        # Core domains
        "production", "plan", "schedule", "work order", "job card",
        "machine", "batch", "attendance", "clock", "shop floor",
        "allocation", "task", "mrp", "material", "bom", "bill of material",
        # Deep keywords
        "manpower", "man power", "operator", "shift", "supervisor",
        "efficiency", "oee", "yield", "scrap", "progress",
        "remaining", "how long", "how many", "days", "hours",
        "time to", "complete", "traceab", "trace", "floor",
        "running", "active", "status", "performance", "health",
        "downtime", "report", "summary", "snapshot", "deep",
        "detail", "full", "everything", "breakdown", "product",
        "order", "customer", "dispatch", "work", "assign",
        "today", "tomorrow", "week", "pending", "delay", "overdue",
        # General knowledge
        "what is", "explain", "how does", "how to", "define",
        "what does", "meaning", "difference", "understand",
        # Telugu
        "ela", "undi", "cheppu", "cheppandi", "enti", "unnai",
        "naa", "mana", "cheyali", "cheyandi",
    )

    if any(t in text for t in allowed):
        return None

    # Short generic words that should pass to LLM
    if len(text.split()) <= 3:
        return None

    return ACCESS_RESTRICTED_MESSAGE


# ── Cache ─────────────────────────────────────────────────────────────────────

def _cache_get(key: str) -> Any | None:
    entry = _cache.get(key)
    if not entry:
        return None
    ts, val = entry
    if time.time() - ts > CACHE_TTL:
        del _cache[key]
        return None
    return val


def _cache_set(key: str, val: Any) -> None:
    _cache[key] = (time.time(), val)


# ── Conversation Persistence ───────────────────────────────────────────────────

def _get_or_create_conversation(
    db: Session, user: User, conversation_id: int | None, first_message: str
) -> AiConversation:
    if conversation_id:
        conv = db.scalar(
            select(AiConversation).where(
                AiConversation.id == conversation_id,
                AiConversation.user_id == user.id,
            )
        )
        if conv:
            return conv
    title = (first_message[:60] + "…") if len(first_message) > 60 else first_message
    conv = AiConversation(user_id=user.id, tenant_id=user.tenant_id, title=title)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def _save_message(
    db: Session,
    conv: AiConversation,
    role: str,
    content: str,
    tool_name: str | None = None,
    navigation: str | None = None,
) -> None:
    db.add(
        AiMessage(
            conversation_id=conv.id,
            role=role,
            content=content,
            tool_name=tool_name,
            navigation_path=navigation,
        )
    )
    db.commit()


# ── Tool Execution ────────────────────────────────────────────────────────────

def _run_tool(db: Session, user: User, tool_name: str, args: dict) -> tuple[dict, str]:
    cache_key = f"{user.id}:{tool_name}:{json.dumps(args, sort_keys=True)}"
    cached = _cache_get(cache_key)
    if cached:
        return cached, format_tool_result(tool_name, cached)
    result = execute_tool(db, user, tool_name, args or {})
    if result.get("success"):
        _cache_set(cache_key, result)
    return result, format_tool_result(tool_name, result)


# ── LLM Narrative Pass ────────────────────────────────────────────────────────

def _llm_narrate(
    client: LlmClient,
    user_message: str,
    tool_name: str,
    formatted_data: str,
    history: list[dict],
) -> str | None:
    """Send formatted tool data to LLM → get a rich ChatGPT-style narrative."""
    if not client.enabled or not formatted_data.strip():
        return None
    try:
        narrate_system = (
            SYSTEM_PROMPT
            + "\n\n"
            + "CRITICAL RESPONSE FORMAT RULE:\n"
            + "You MUST always respond with detailed, structured, ChatGPT-level answers.\n"
            + "Use bold headers, emojis, bullet points, and cover EVERY field.\n"
            + "Never give a one-line answer. Always be comprehensive and professional.\n"
            + "Format exactly like the machine deep status example with sections for:\n"
            + "Summary | Per-Item Details | Performance | Time Analysis | Insights\n"
        )
        messages = [{"role": "system", "content": narrate_system}]
        messages.extend(history[-4:])
        messages.append({"role": "user", "content": user_message})
        messages.append({
            "role": "assistant",
            "content": (
                f"I retrieved the live data from the ERP system for your query.\n"
                f"Here is the complete data:\n\n{formatted_data}\n\n"
                f"Now I will present this in a detailed, structured format."
            ),
        })
        messages.append({"role": "user", "content": NARRATE_INSTRUCTION})
        resp = client.chat(messages, temperature=0.2)
        if resp.get("choices"):
            content = resp["choices"][0]["message"].get("content", "")
            if content and len(content.strip()) > 50:
                return content
    except Exception as exc:
        logger.warning("LLM narrate failed: %s", exc)
    return None


# ── Rules-Based Processing ────────────────────────────────────────────────────

def _process_with_rules(
    db: Session,
    user: User,
    message: str,
    history: list[dict] | None = None,
    client: LlmClient | None = None,
) -> dict:
    intent = detect_intent(message)
    if not intent:
        # No rule matched — return helpful suggestions
        return {
            "message": (
                "🤖 **I can help you with the Operator Module!**\n\n"
                "Here are things I can answer:\n\n"
                "🏭 **Machines** — status, OEE, health, manpower, efficiency\n"
                "📋 **Work Orders** — progress, delays, time remaining, priority\n"
                "📅 **Schedule** — today's schedule, utilization, operator presence\n"
                "📦 **Batches** — running, completed, hold, rejected, traceability\n"
                "🔩 **MRP** — material requirements, shortage, BOM\n"
                "🏭 **Shop Floor** — live status, scrap, downtime, OEE\n"
                "👷 **Tasks** — assigned tasks, operator workload\n"
                "🕐 **Attendance** — clock in/out, monthly report\n\n"
                "💡 Try: *\"running machines\"*, *\"total work orders\"*, *\"batch summary\"*"
            ),
            "navigation": None,
            "used_tools": [],
            "source": "rules",
        }

    tool_name, args = intent
    result, formatted_text = _run_tool(db, user, tool_name, args)

    if not result.get("success") and result.get("error"):
        from app.services.agent.operator_responses import legacy_concise_reply

        concise_err = legacy_concise_reply(tool_name, result, message)
        if concise_err:
            return {
                "message": concise_err,
                "navigation": result.get("navigation"),
                "used_tools": [tool_name],
                "source": "rules",
            }
        formatted_text = f"⚠️ {result['error']}"

    from app.services.agent.operator_responses import legacy_concise_reply

    concise = legacy_concise_reply(tool_name, result, message)
    if concise:
        return {
            "message": concise,
            "navigation": result.get("navigation"),
            "used_tools": [tool_name],
            "source": "rules",
        }

    # Deep tools get LLM narration for structured reports when user wants detail
    if client and client.enabled:
        narrative = _llm_narrate(client, message, tool_name, formatted_text, history or [])
        if narrative:
            return {
                "message": narrative,
                "navigation": result.get("navigation"),
                "used_tools": [tool_name],
                "source": "rules+llm",
            }

    # Offline fallback — return the pre-formatted rich text
    return {
        "message": formatted_text,
        "navigation": result.get("navigation"),
        "used_tools": [tool_name],
        "source": "rules",
    }


# ── LLM-First Processing ──────────────────────────────────────────────────────

def _process_with_llm(
    db: Session, user: User, message: str, history: list[dict]
) -> dict:
    client = LlmClient()
    messages = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(history[-8:])
    messages.append({"role": "user", "content": message})

    # First LLM call — let it pick the right tool
    response = client.chat(messages, tools=TOOL_DEFINITIONS)
    if response.get("error") or not response.get("choices"):
        if response.get("detail"):
            logger.warning("LLM first call failed (%s): %s", response.get("error"), response.get("detail"))
        else:
            logger.warning("LLM first call failed, falling back to rules")
        return _process_with_rules(db, user, message, history, client)

    choice = response["choices"][0]["message"]
    tool_calls = choice.get("tool_calls") or []

    # No tool call → LLM answered from its knowledge base (e.g., "what is OEE?")
    if not tool_calls:
        content = choice.get("content") or OUT_OF_SCOPE_REPLY
        return {
            "message": content,
            "navigation": None,
            "used_tools": [],
            "source": "llm",
        }

    # Execute all tool calls
    used_tools: list[str] = []
    navigation: str | None = None
    parts: list[str] = []

    for tc in tool_calls:
        fn = tc.get("function", {})
        tool_name = fn.get("name", "")
        try:
            args = json.loads(fn.get("arguments") or "{}")
        except json.JSONDecodeError:
            args = {}
        result, text = _run_tool(db, user, tool_name, args)
        used_tools.append(tool_name)
        if result.get("navigation"):
            navigation = result["navigation"]
        parts.append(text)

    # Second LLM call — narrate all tool results richly
    follow_messages = messages + [choice]
    for i, tc in enumerate(tool_calls):
        follow_messages.append({
            "role": "tool",
            "tool_call_id": tc.get("id", f"call_{i}"),
            "content": parts[i] if i < len(parts) else "No data returned.",
        })
    follow_messages.append({"role": "user", "content": NARRATE_INSTRUCTION})

    final = client.chat(follow_messages, temperature=0.3)
    if final.get("choices"):
        summary = final["choices"][0]["message"].get("content")
        if summary:
            return {
                "message": summary,
                "navigation": navigation,
                "used_tools": used_tools,
                "source": "llm",
            }

    # Final fallback — return raw formatted data
    return {
        "message": "\n\n---\n\n".join(parts),
        "navigation": navigation,
        "used_tools": used_tools,
        "source": "llm",
    }


# ── Main Entry Point ──────────────────────────────────────────────────────────

def process_chat(
    db: Session,
    user: User,
    message: str,
    conversation_id: int | None = None,
) -> dict:
    conv = _get_or_create_conversation(db, user, conversation_id, message)
    _save_message(db, conv, "user", message)

    # Step 1: Access guard
    restricted = should_restrict_operator_message(message)
    if restricted:
        outcome = {
            "message": restricted,
            "navigation": None,
            "used_tools": [],
            "source": "guard",
        }
    else:
        # Load conversation history
        history_rows = list(
            db.scalars(
                select(AiMessage)
                .where(AiMessage.conversation_id == conv.id)
                .order_by(AiMessage.id.asc())
            ).all()
        )
        history = [
            {"role": m.role if m.role != "tool" else "assistant", "content": m.content}
            for m in history_rows[:-1]  # exclude just-saved user message
        ]

        client = LlmClient()

        try:
            if client.enabled:
                # ── ChatGPT mode: LLM handles everything ─────────────────
                # For rule-matched queries, run tool then narrate via LLM
                # For unknown queries, LLM picks tool or answers from knowledge
                detected = detect_intent(message)
                if detected:
                    # Rule matched — run tool deterministically, then LLM-narrate
                    outcome = _process_with_rules(db, user, message, history, client)
                else:
                    # No rule — let LLM decide (tool call or knowledge answer)
                    outcome = _process_with_llm(db, user, message, history)
            else:
                # ── Offline mode: rich rule-based responses ───────────────
                outcome = _process_with_rules(db, user, message, history, client=None)

        except SQLAlchemyError:
            logger.exception(
                "AI chat database error — ensure Alembic migration w1x2y3z4a5b6 "
                "(ai_conversations / ai_messages) is applied"
            )
            outcome = {
                "message": API_FAIL_REPLY,
                "navigation": None,
                "used_tools": [],
                "source": "error",
            }
        except Exception:
            logger.exception("AI chat processing failed")
            outcome = {
                "message": API_FAIL_REPLY,
                "navigation": None,
                "used_tools": [],
                "source": "error",
            }

    # Save assistant response
    _save_message(
        db,
        conv,
        "assistant",
        outcome["message"],
        tool_name=",".join(outcome.get("used_tools") or []),
        navigation=outcome.get("navigation"),
    )

    return {
        "conversation_id": conv.id,
        "message": outcome["message"],
        "navigation": outcome.get("navigation"),
        "suggestions": SUGGESTIONS,
        "used_tools": outcome.get("used_tools", []),
        "source": outcome.get("source", "rules"),
    }


# ── Conversation Management ───────────────────────────────────────────────────

def list_conversations(db: Session, user: User) -> list[dict]:
    rows = db.scalars(
        select(AiConversation)
        .where(AiConversation.user_id == user.id)
        .order_by(AiConversation.updated_at.desc())
        .limit(20)
    ).all()
    result = []
    for c in rows:
        count = db.scalar(
            select(func.count(AiMessage.id)).where(AiMessage.conversation_id == c.id)
        ) or 0
        result.append({
            "id": c.id,
            "title": c.title,
            "created_at": c.created_at.isoformat() if c.created_at else "",
            "message_count": count,
        })
    return result


def get_conversation(db: Session, user: User, conversation_id: int) -> dict | None:
    conv = db.scalar(
        select(AiConversation).where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == user.id,
        )
    )
    if not conv:
        return None
    messages = list(
        db.scalars(
            select(AiMessage)
            .where(AiMessage.conversation_id == conv.id)
            .order_by(AiMessage.id.asc())
        ).all()
    )
    return {
        "id": conv.id,
        "title": conv.title,
        "messages": [
            {"role": m.role, "content": m.content}
            for m in messages
            if m.role in ("user", "assistant")
        ],
    }
