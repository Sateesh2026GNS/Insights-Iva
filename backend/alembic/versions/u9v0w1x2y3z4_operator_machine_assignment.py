"""Operator machine assignment and production entries.

Revision ID: u9v0w1x2y3z4
Revises: t8u9v0w1x2y3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "u9v0w1x2y3z4"
down_revision: Union[str, Sequence[str], None] = "t8u9v0w1x2y3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("machines", sa.Column("assigned_operator_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_machines_assigned_operator_id",
        "machines",
        "users",
        ["assigned_operator_id"],
        ["id"],
    )
    op.create_index("ix_machines_assigned_operator_id", "machines", ["assigned_operator_id"])

    op.create_table(
        "production_entries",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("work_order_id", sa.Integer(), nullable=False),
        sa.Column("job_card_id", sa.Integer(), nullable=True),
        sa.Column("operator_user_id", sa.Integer(), nullable=False),
        sa.Column("quantity_produced", sa.Numeric(12, 2), nullable=False),
        sa.Column("quantity_rejected", sa.Numeric(12, 2), nullable=False),
        sa.Column("reject_reason", sa.String(length=255), nullable=True),
        sa.Column("shift", sa.String(length=64), nullable=True),
        sa.Column("recorded_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.ForeignKeyConstraint(["operator_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_production_entries_tenant_id", "production_entries", ["tenant_id"])
    op.create_index("ix_production_entries_work_order_id", "production_entries", ["work_order_id"])
    op.create_index("ix_production_entries_operator_user_id", "production_entries", ["operator_user_id"])


def downgrade() -> None:
    op.drop_index("ix_production_entries_operator_user_id", table_name="production_entries")
    op.drop_index("ix_production_entries_work_order_id", table_name="production_entries")
    op.drop_index("ix_production_entries_tenant_id", table_name="production_entries")
    op.drop_table("production_entries")
    op.drop_index("ix_machines_assigned_operator_id", table_name="machines")
    op.drop_constraint("fk_machines_assigned_operator_id", "machines", type_="foreignkey")
    op.drop_column("machines", "assigned_operator_id")
