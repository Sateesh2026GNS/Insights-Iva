"""Report favorites, visits, custom reports, and shares.

Revision ID: a9c0d1e2f3b4
Revises: z8b9c0d1e2f3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9c0d1e2f3b4"
down_revision: Union[str, Sequence[str], None] = "z8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())

    if "report_favorites" not in tables:
        op.create_table(
            "report_favorites",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("report_slug", sa.String(length=128), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "user_id", "report_slug", name="uq_report_favorites_user_slug"),
        )
        op.create_index("ix_report_favorites_tenant_id", "report_favorites", ["tenant_id"])
        op.create_index("ix_report_favorites_user_id", "report_favorites", ["user_id"])
        op.create_index("ix_report_favorites_report_slug", "report_favorites", ["report_slug"])

    if "report_visits" not in tables:
        op.create_table(
            "report_visits",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("user_id", sa.Integer(), nullable=False),
            sa.Column("report_slug", sa.String(length=128), nullable=False),
            sa.Column("last_visited_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "user_id", "report_slug", name="uq_report_visits_user_slug"),
        )
        op.create_index("ix_report_visits_tenant_id", "report_visits", ["tenant_id"])
        op.create_index("ix_report_visits_user_id", "report_visits", ["user_id"])
        op.create_index("ix_report_visits_report_slug", "report_visits", ["report_slug"])

    if "custom_reports" not in tables:
        op.create_table(
            "custom_reports",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("owner_user_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("category", sa.String(length=64), nullable=False),
            sa.Column("description", sa.Text(), nullable=False),
            sa.Column("base_source", sa.String(length=64), nullable=False),
            sa.Column("columns_json", sa.Text(), nullable=False),
            sa.Column("filters_json", sa.Text(), nullable=False),
            sa.Column("group_by_json", sa.Text(), nullable=False),
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_custom_reports_tenant_id", "custom_reports", ["tenant_id"])
        op.create_index("ix_custom_reports_owner_user_id", "custom_reports", ["owner_user_id"])

    if "report_shares" not in tables:
        op.create_table(
            "report_shares",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("report_slug", sa.String(length=128), nullable=False),
            sa.Column("shared_by_user_id", sa.Integer(), nullable=False),
            sa.Column("shared_with_user_id", sa.Integer(), nullable=True),
            sa.Column("shared_with_role", sa.String(length=64), nullable=True),
            sa.Column("custom_report_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["shared_by_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["shared_with_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["custom_report_id"], ["custom_reports.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_report_shares_tenant_id", "report_shares", ["tenant_id"])
        op.create_index("ix_report_shares_report_slug", "report_shares", ["report_slug"])
        op.create_index("ix_report_shares_shared_by_user_id", "report_shares", ["shared_by_user_id"])
        op.create_index("ix_report_shares_shared_with_user_id", "report_shares", ["shared_with_user_id"])
        op.create_index("ix_report_shares_custom_report_id", "report_shares", ["custom_report_id"])


def downgrade() -> None:
    for table in ("report_shares", "custom_reports", "report_visits", "report_favorites"):
        op.drop_table(table)
