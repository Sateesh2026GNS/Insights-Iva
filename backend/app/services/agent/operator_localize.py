"""Localize operator factual answers to the user's language via OpenAI (numbers unchanged)."""

from __future__ import annotations

import logging
import re

from app.services.agent.llm_client import AgentLlmClient

logger = logging.getLogger(__name__)

_TELUGU = re.compile(r"[\u0C00-\u0C7F]")
_DEVANAGARI = re.compile(r"[\u0900-\u097F]")
_MIXED_HINTS = re.compile(
    r"\b(enni|enti|entha|unnayi|chupinchu|cheppu|naa|mana|aaj|kitne|hain|hai|kya)\b",
    re.IGNORECASE,
)


def user_prefers_non_english(user_message: str) -> bool:
    text = (user_message or "").strip()
    if not text:
        return False
    if _TELUGU.search(text) or _DEVANAGARI.search(text):
        return True
    return bool(_MIXED_HINTS.search(text))


def localize_operator_text(
    user_message: str,
    answer_text: str,
    insight: str | None = None,
) -> tuple[str, str | None]:
    """Return (answer, insight) in the user's language when possible."""
    if not user_prefers_non_english(user_message):
        return answer_text, insight

    client = AgentLlmClient()
    if not client.enabled:
        return answer_text, insight

    payload = f"ANSWER:\n{answer_text}"
    if insight:
        payload += f"\n\nINSIGHT:\n{insight}"

    messages = [
        {
            "role": "system",
            "content": (
                "You translate ERP assistant replies for factory operators. "
                "Respond in the SAME language/script style as the user's message "
                "(Telugu, Hindi, or Telugu/Hindi-English mix). "
                "Keep all numbers, work order codes, and ERP terms (Work Order, Production, Machine, Shift) unchanged. "
                "Do not add facts, advice, or recommendations. "
                "Return exactly two sections if insight is provided:\n"
                "ANSWER:\n...\n\nINSIGHT:\n...\n"
                "If there is no insight, return only ANSWER:\n..."
            ),
        },
        {"role": "user", "content": f"User asked:\n{user_message}\n\n{payload}"},
    ]
    try:
        resp = client.chat(messages, tools=None, temperature=0.1)
        choices = resp.get("choices") or []
        if not choices:
            return answer_text, insight
        content = (choices[0].get("message") or {}).get("content") or ""
        if "ANSWER:" in content:
            parts = content.split("INSIGHT:", 1)
            ans = parts[0].replace("ANSWER:", "", 1).strip()
            ins = parts[1].strip() if len(parts) > 1 else None
            return ans or answer_text, ins if ins else insight
        if content.strip():
            return content.strip(), insight
    except Exception as exc:
        logger.warning("Operator answer localization failed: %s", exc)
    return answer_text, insight
