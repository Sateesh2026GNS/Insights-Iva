from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ai_agent import AiAgentConversation, AiAgentMessage


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
