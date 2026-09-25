"""Tenant-scoped work chat — conversations, members, messages."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class WorkChatConversation(Base, TimestampMixin):
    __tablename__ = "work_chat_conversations"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "direct_user_low_id",
            "direct_user_high_id",
            name="uq_work_chat_direct_pair",
        ),
        Index("ix_work_chat_conv_tenant_activity", "tenant_id", "last_message_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    conversation_type: Mapped[str] = mapped_column(String(16), nullable=False)  # direct | group
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    direct_user_low_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    direct_user_high_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    last_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_message_preview: Mapped[str | None] = mapped_column(String(512), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    members = relationship("WorkChatMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("WorkChatMessage", back_populates="conversation", cascade="all, delete-orphan")


class WorkChatMember(Base, TimestampMixin):
    __tablename__ = "work_chat_members"
    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_work_chat_member"),
        Index("ix_work_chat_member_user", "tenant_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("work_chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    member_role: Mapped[str] = mapped_column(String(16), nullable=False, default="member")
    last_read_message_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    left_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    conversation = relationship("WorkChatConversation", back_populates="members")


class WorkChatMessage(Base, TimestampMixin):
    __tablename__ = "work_chat_messages"
    __table_args__ = (
        Index("ix_work_chat_msg_conv_created", "conversation_id", "id"),
        Index("ix_work_chat_msg_tenant", "tenant_id", "conversation_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("work_chat_conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    reply_to_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("work_chat_messages.id"), nullable=True
    )
    mention_user_ids: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON array
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    conversation = relationship("WorkChatConversation", back_populates="messages")
    attachments = relationship("WorkChatMessageAttachment", back_populates="message", cascade="all, delete-orphan")
    links = relationship("WorkChatMessageLink", back_populates="message", cascade="all, delete-orphan")


class WorkChatMessageAttachment(Base, TimestampMixin):
    __tablename__ = "work_chat_message_attachments"
    __table_args__ = (UniqueConstraint("message_id", "file_id", name="uq_work_chat_msg_file"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("work_chat_messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    file_id: Mapped[int] = mapped_column(ForeignKey("stored_files.id"), nullable=False, index=True)

    message = relationship("WorkChatMessage", back_populates="attachments")


class WorkChatMessageLink(Base, TimestampMixin):
    __tablename__ = "work_chat_message_links"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    message_id: Mapped[int] = mapped_column(
        ForeignKey("work_chat_messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    path: Mapped[str | None] = mapped_column(String(512), nullable=True)

    message = relationship("WorkChatMessage", back_populates="links")
