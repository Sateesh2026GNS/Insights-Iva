"""AI Operator Agent — conversations and audit log."""

from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class AiAgentConversation(Base, TimestampMixin):
    __tablename__ = "ai_agent_conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    external_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    messages = relationship(
        "AiAgentMessage",
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="AiAgentMessage.id",
    )


class AiAgentMessage(Base, TimestampMixin):
    __tablename__ = "ai_agent_messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("ai_agent_conversations.id"), nullable=False, index=True
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # user | assistant
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    payload_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    conversation = relationship("AiAgentConversation", back_populates="messages")


class AiAgentLog(Base, TimestampMixin):
    __tablename__ = "ai_agent_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str | None] = mapped_column(String(64))
    user_message: Mapped[str | None] = mapped_column(Text)
    tool_name: Mapped[str | None] = mapped_column(String(64), index=True)
    tool_params: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result_row_count: Mapped[int | None] = mapped_column(Integer)
    result_truncated: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    response_text: Mapped[str | None] = mapped_column(Text)
    latency_ms: Mapped[int | None] = mapped_column(Integer)
    tool_sensitivity: Mapped[str | None] = mapped_column(String(16), nullable=True)
    sensitive_targets: Mapped[dict | None] = mapped_column(JSON, nullable=True)
