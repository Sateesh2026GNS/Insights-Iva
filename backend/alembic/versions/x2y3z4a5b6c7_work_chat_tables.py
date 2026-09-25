"""Work chat conversations and messages.

Revision ID: x2y3z4a5b6c7
Revises: w1x2y3z4a5b6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "x2y3z4a5b6c7"
down_revision: Union[str, Sequence[str], None] = "w1x2y3z4a5b6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "work_chat_conversations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("conversation_type", sa.String(length=16), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=False),
        sa.Column("direct_user_low_id", sa.Integer(), nullable=True),
        sa.Column("direct_user_high_id", sa.Integer(), nullable=True),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_message_preview", sa.String(length=512), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["direct_user_high_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["direct_user_low_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "direct_user_low_id", "direct_user_high_id", name="uq_work_chat_direct_pair"),
    )
    op.create_index("ix_work_chat_conversations_tenant_id", "work_chat_conversations", ["tenant_id"])
    op.create_index("ix_work_chat_conv_tenant_activity", "work_chat_conversations", ["tenant_id", "last_message_at"])

    op.create_table(
        "work_chat_members",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("member_role", sa.String(length=16), nullable=False),
        sa.Column("last_read_message_id", sa.Integer(), nullable=True),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["work_chat_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("conversation_id", "user_id", name="uq_work_chat_member"),
    )
    op.create_index("ix_work_chat_members_tenant_id", "work_chat_members", ["tenant_id"])
    op.create_index("ix_work_chat_members_conversation_id", "work_chat_members", ["conversation_id"])
    op.create_index("ix_work_chat_members_user_id", "work_chat_members", ["user_id"])
    op.create_index("ix_work_chat_member_user", "work_chat_members", ["tenant_id", "user_id"])

    op.create_table(
        "work_chat_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("conversation_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("reply_to_message_id", sa.Integer(), nullable=True),
        sa.Column("mention_user_ids", sa.Text(), nullable=True),
        sa.Column("edited_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["conversation_id"], ["work_chat_conversations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["reply_to_message_id"], ["work_chat_messages.id"]),
        sa.ForeignKeyConstraint(["sender_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_chat_messages_tenant_id", "work_chat_messages", ["tenant_id"])
    op.create_index("ix_work_chat_messages_conversation_id", "work_chat_messages", ["conversation_id"])
    op.create_index("ix_work_chat_msg_conv_created", "work_chat_messages", ["conversation_id", "id"])
    op.create_index("ix_work_chat_msg_tenant", "work_chat_messages", ["tenant_id", "conversation_id"])

    op.create_table(
        "work_chat_message_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["file_id"], ["stored_files.id"]),
        sa.ForeignKeyConstraint(["message_id"], ["work_chat_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("message_id", "file_id", name="uq_work_chat_msg_file"),
    )
    op.create_index("ix_work_chat_message_attachments_tenant_id", "work_chat_message_attachments", ["tenant_id"])
    op.create_index("ix_work_chat_message_attachments_message_id", "work_chat_message_attachments", ["message_id"])

    op.create_table(
        "work_chat_message_links",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("message_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("path", sa.String(length=512), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["message_id"], ["work_chat_messages.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_work_chat_message_links_tenant_id", "work_chat_message_links", ["tenant_id"])
    op.create_index("ix_work_chat_message_links_message_id", "work_chat_message_links", ["message_id"])


def downgrade() -> None:
    op.drop_table("work_chat_message_links")
    op.drop_table("work_chat_message_attachments")
    op.drop_table("work_chat_messages")
    op.drop_table("work_chat_members")
    op.drop_table("work_chat_conversations")
