"""Persistent report export download tokens.

Revision ID: rc4b5c6d7e8f9
Revises: rc3a4b5c6d7e8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "rc4b5c6d7e8f9"
down_revision: Union[str, Sequence[str], None] = "rc3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "report_export_tokens" in insp.get_table_names():
        return
    op.create_table(
        "report_export_tokens",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("token", sa.String(length=128), nullable=False),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("created_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("storage_key", sa.String(length=512), nullable=False),
        sa.Column("content_type", sa.String(length=128), nullable=False),
        sa.Column("filename", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP")),
        sa.UniqueConstraint("token", name="uq_report_export_tokens_token"),
    )
    op.create_index("ix_report_export_tokens_token", "report_export_tokens", ["token"])
    op.create_index("ix_report_export_tokens_tenant_id", "report_export_tokens", ["tenant_id"])
    op.create_index("ix_report_export_tokens_expires_at", "report_export_tokens", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "report_export_tokens" not in insp.get_table_names():
        return
    op.drop_index("ix_report_export_tokens_expires_at", table_name="report_export_tokens")
    op.drop_index("ix_report_export_tokens_tenant_id", table_name="report_export_tokens")
    op.drop_index("ix_report_export_tokens_token", table_name="report_export_tokens")
    op.drop_table("report_export_tokens")
