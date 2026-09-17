"""Report saved views and schedules.

Revision ID: r6s7t8u9v0w1
Revises: q5r6s7t8u9v0
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "r6s7t8u9v0w1"
down_revision: Union[str, Sequence[str], None] = "q5r6s7t8u9v0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "report_saved_views",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("report_key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("filters_json", sa.Text(), nullable=False),
        sa.Column("is_shared", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_saved_views_tenant_id", "report_saved_views", ["tenant_id"])
    op.create_index("ix_report_saved_views_user_id", "report_saved_views", ["user_id"])
    op.create_index("ix_report_saved_views_report_key", "report_saved_views", ["report_key"])

    op.create_table(
        "report_schedules",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("report_key", sa.String(length=64), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("filters_json", sa.Text(), nullable=False),
        sa.Column("frequency", sa.String(length=16), nullable=False),
        sa.Column("send_at", sa.Time(), nullable=False),
        sa.Column("recipients_json", sa.Text(), nullable=False),
        sa.Column("format", sa.String(length=8), nullable=False, server_default="xlsx"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_report_schedules_tenant_id", "report_schedules", ["tenant_id"])
    op.create_index("ix_report_schedules_user_id", "report_schedules", ["user_id"])
    op.create_index("ix_report_schedules_report_key", "report_schedules", ["report_key"])


def downgrade() -> None:
    op.drop_table("report_schedules")
    op.drop_table("report_saved_views")
