"""Operator AI assistant conversation history (POST /ai/chat).

Revision ID: w1x2y3z4a5b6
Revises: v0w1x2y3z4a5
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "w1x2y3z4a5b6"
down_revision: Union[str, Sequence[str], None] = "v0w1x2y3z4a5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing = set(insp.get_table_names())

    if "ai_conversations" not in existing:
        op.create_table(
            "ai_conversations",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])
        op.create_index("ix_ai_conversations_tenant_id", "ai_conversations", ["tenant_id"])
    else:
        existing_indexes = {idx["name"] for idx in insp.get_indexes("ai_conversations")}
        if "ix_ai_conversations_user_id" not in existing_indexes:
            op.create_index("ix_ai_conversations_user_id", "ai_conversations", ["user_id"])
        if "ix_ai_conversations_tenant_id" not in existing_indexes:
            op.create_index("ix_ai_conversations_tenant_id", "ai_conversations", ["tenant_id"])

    if "ai_messages" not in existing:
        op.create_table(
            "ai_messages",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("conversation_id", sa.Integer(), nullable=False),
            sa.Column("role", sa.String(length=16), nullable=False),
            sa.Column("content", sa.Text(), nullable=False),
            sa.Column("tool_name", sa.String(length=64), nullable=True),
            sa.Column("navigation_path", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["conversation_id"], ["ai_conversations.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"])
    else:
        existing_indexes = {idx["name"] for idx in insp.get_indexes("ai_messages")}
        if "ix_ai_messages_conversation_id" not in existing_indexes:
            op.create_index("ix_ai_messages_conversation_id", "ai_messages", ["conversation_id"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if "ai_messages" in tables:
        op.drop_table("ai_messages")
    if "ai_conversations" in tables:
        op.drop_table("ai_conversations")
