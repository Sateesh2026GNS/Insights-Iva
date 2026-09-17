"""AI operator agent conversations and audit log.

Revision ID: s7t8u9v0w1x2
Revises: r6s7t8u9v0w1
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "s7t8u9v0w1x2"
down_revision: Union[str, Sequence[str], None] = "r6s7t8u9v0w1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ai_agent_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("external_id", sa.String(length=64), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_agent_conversations_tenant_id", "ai_agent_conversations", ["tenant_id"])
    op.create_index("ix_ai_agent_conversations_user_id", "ai_agent_conversations", ["user_id"])
    op.create_index("ix_ai_agent_conversations_external_id", "ai_agent_conversations", ["external_id"])

    op.create_table(
        "ai_agent_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("payload_json", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["ai_agent_conversations.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_agent_messages_conversation_id", "ai_agent_messages", ["conversation_id"])

    op.create_table(
        "ai_agent_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=64), nullable=True),
        sa.Column("user_message", sa.Text(), nullable=True),
        sa.Column("tool_name", sa.String(length=64), nullable=True),
        sa.Column("tool_params", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("result_row_count", sa.Integer(), nullable=True),
        sa.Column("result_truncated", sa.Boolean(), nullable=True),
        sa.Column("response_text", sa.Text(), nullable=True),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_ai_agent_log_tenant_id", "ai_agent_log", ["tenant_id"])
    op.create_index("ix_ai_agent_log_user_id", "ai_agent_log", ["user_id"])
    op.create_index("ix_ai_agent_log_tool_name", "ai_agent_log", ["tool_name"])


def downgrade() -> None:
    op.drop_index("ix_ai_agent_log_tool_name", table_name="ai_agent_log")
    op.drop_index("ix_ai_agent_log_user_id", table_name="ai_agent_log")
    op.drop_index("ix_ai_agent_log_tenant_id", table_name="ai_agent_log")
    op.drop_table("ai_agent_log")
    op.drop_index("ix_ai_agent_messages_conversation_id", table_name="ai_agent_messages")
    op.drop_table("ai_agent_messages")
    op.drop_index("ix_ai_agent_conversations_external_id", table_name="ai_agent_conversations")
    op.drop_index("ix_ai_agent_conversations_user_id", table_name="ai_agent_conversations")
    op.drop_index("ix_ai_agent_conversations_tenant_id", table_name="ai_agent_conversations")
    op.drop_table("ai_agent_conversations")
