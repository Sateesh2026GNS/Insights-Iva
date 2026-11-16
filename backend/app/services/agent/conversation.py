from __future__ import annotations

import re
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.ai_agent import AiAgentConversation, AiAgentMessage

_CONTEXT_PREFIX = re.compile(r"^\[Context:[^\]]*\]\s*", re.IGNORECASE)


def conversation_display_title(text: str | None, limit: int = 80) -> str:
    raw = _CONTEXT_PREFIX.sub("", (text or "").strip())
    raw = " ".join(raw.split())
    if not raw:
        return "New chat"
    if len(raw) <= limit:
        return raw
    return raw[: limit - 1].rstrip() + "…"


def get_or_create_conversation(
    db: Session,
    tenant_id: int,
    user_id: int,
    conversation_id: str | None,
) -> AiAgentConversation:
    ext = (conversation_id or "").strip() or str(uuid.uuid4())
    conv = db.scalar(
        select(AiAgentConversation).where(
            AiAgentConversation.tenant_id == tenant_id,
            AiAgentConversation.user_id == user_id,
            AiAgentConversation.external_id == ext,
        )
    )
    if conv:
        return conv
    conv = AiAgentConversation(tenant_id=tenant_id, user_id=user_id, external_id=ext)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv


def append_message(
    db: Session,
    conversation: AiAgentConversation,
    role: str,
    content: str,
    payload: dict[str, Any] | None = None,
) -> None:
    db.add(
        AiAgentMessage(
            conversation_id=conversation.id,
            role=role,
            content=content,
            payload_json=payload,
        )
    )
    conversation.updated_at = datetime.now(timezone.utc)
    db.commit()


def recent_messages_for_llm(
    db: Session, conversation: AiAgentConversation, limit: int = 12
) -> list[dict[str, str]]:
    rows = db.scalars(
        select(AiAgentMessage)
        .where(AiAgentMessage.conversation_id == conversation.id)
        .order_by(AiAgentMessage.id.desc())
        .limit(limit)
    ).all()
    out: list[dict[str, str]] = []
    for msg in reversed(rows):
        if msg.role in ("user", "assistant"):
            out.append({"role": msg.role, "content": msg.content})
    return out


def _iso(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def list_user_conversations(
    db: Session,
    tenant_id: int,
    user_id: int,
    search: str | None = None,
    limit: int = 50,
) -> list[dict[str, Any]]:
    convs = db.scalars(
        select(AiAgentConversation)
        .where(
            AiAgentConversation.tenant_id == tenant_id,
            AiAgentConversation.user_id == user_id,
        )
        .order_by(AiAgentConversation.updated_at.desc(), AiAgentConversation.id.desc())
        .limit(200)
    ).all()
    query = (search or "").strip().lower()
    items: list[dict[str, Any]] = []
    for conv in convs:
        first = db.scalar(
            select(AiAgentMessage)
            .where(
                AiAgentMessage.conversation_id == conv.id,
                AiAgentMessage.role == "user",
            )
            .order_by(AiAgentMessage.id.asc())
            .limit(1)
        )
        title = conversation_display_title(first.content if first else "")
        haystack = f"{title} {(first.content if first else '')}".lower()
        if query and query not in haystack:
            continue
        items.append(
            {
                "id": conv.external_id,
                "title": title,
                "created_at": _iso(conv.created_at),
                "updated_at": _iso(conv.updated_at),
            }
        )
        if len(items) >= limit:
            break
    return items


def get_user_conversation(
    db: Session,
    tenant_id: int,
    user_id: int,
    external_id: str,
) -> dict[str, Any] | None:
    ext = (external_id or "").strip()
    if not ext:
        return None
    conv = db.scalar(
        select(AiAgentConversation).where(
            AiAgentConversation.tenant_id == tenant_id,
            AiAgentConversation.user_id == user_id,
            AiAgentConversation.external_id == ext,
        )
    )
    if not conv:
        return None
    rows = db.scalars(
        select(AiAgentMessage)
        .where(AiAgentMessage.conversation_id == conv.id)
        .order_by(AiAgentMessage.id.asc())
    ).all()
    first_user = next((row.content for row in rows if row.role == "user"), "")
    return {
        "id": conv.external_id,
        "title": conversation_display_title(first_user),
        "created_at": _iso(conv.created_at),
        "updated_at": _iso(conv.updated_at),
        "messages": [
            {
                "id": row.id,
                "role": row.role,
                "content": row.content,
                "created_at": _iso(row.created_at),
                "payload": row.payload_json,
            }
            for row in rows
        ],
    }


def delete_user_conversation(
    db: Session,
    tenant_id: int,
    user_id: int,
    external_id: str,
) -> bool:
    ext = (external_id or "").strip()
    if not ext:
        return False
    conv = db.scalar(
        select(AiAgentConversation).where(
            AiAgentConversation.tenant_id == tenant_id,
            AiAgentConversation.user_id == user_id,
            AiAgentConversation.external_id == ext,
        )
    )
    if not conv:
        return False
    db.execute(delete(AiAgentMessage).where(AiAgentMessage.conversation_id == conv.id))
    db.delete(conv)
    db.commit()
    return True
