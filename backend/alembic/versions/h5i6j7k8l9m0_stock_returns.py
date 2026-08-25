"""Add stock_returns and stock_return_lines tables.

Revision ID: h5i6j7k8l9m0
Revises: g4h5i6j7k8l9
Create Date: 2026-08-24 10:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "h5i6j7k8l9m0"
down_revision: Union[str, Sequence[str], None] = "g4h5i6j7k8l9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    tables = set(inspect(bind).get_table_names())

    if "stock_returns" not in tables:
        op.create_table(
            "stock_returns",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("return_number", sa.String(length=64), nullable=False),
            sa.Column("return_date", sa.Date(), nullable=True),
            sa.Column("return_type", sa.String(length=64), nullable=False),
            sa.Column("reference_no", sa.String(length=128), nullable=True),
            sa.Column("reference_type", sa.String(length=64), nullable=True),
            sa.Column("reference_id", sa.Integer(), nullable=True),
            sa.Column("department", sa.String(length=64), nullable=True),
            sa.Column("returned_by", sa.String(length=255), nullable=True),
            sa.Column("returned_by_user_id", sa.Integer(), nullable=True),
            sa.Column("return_to_warehouse_id", sa.Integer(), nullable=False),
            sa.Column("reason", sa.String(length=128), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            sa.Column("total_qty", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_by", sa.String(length=255), nullable=True),
            sa.Column("updated_by", sa.String(length=255), nullable=True),
            sa.Column("verified_by", sa.String(length=255), nullable=True),
            sa.Column("quality_checked_by", sa.String(length=255), nullable=True),
            sa.Column("completed_by", sa.String(length=255), nullable=True),
            sa.Column("rejected_by", sa.String(length=255), nullable=True),
            sa.Column("rejection_reason", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["return_to_warehouse_id"], ["warehouses.id"]),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_stock_returns_tenant_id", "stock_returns", ["tenant_id"])
        op.create_index("ix_stock_returns_return_number", "stock_returns", ["return_number"])

    if "stock_return_lines" not in tables:
        op.create_table(
            "stock_return_lines",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("stock_return_id", sa.Integer(), nullable=False),
            sa.Column("line_no", sa.Integer(), nullable=False),
            sa.Column("item_id", sa.Integer(), nullable=False),
            sa.Column("batch_number", sa.String(length=64), nullable=True),
            sa.Column("available_qty", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("return_qty", sa.Integer(), nullable=False),
            sa.Column("unit", sa.String(length=32), nullable=False, server_default="pcs"),
            sa.Column("condition", sa.String(length=32), nullable=False, server_default="good"),
            sa.Column("warehouse_id", sa.Integer(), nullable=False),
            sa.Column("line_reason", sa.String(length=128), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
            sa.ForeignKeyConstraint(["stock_return_id"], ["stock_returns.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_stock_return_lines_stock_return_id", "stock_return_lines", ["stock_return_id"])


def downgrade() -> None:
    op.drop_index("ix_stock_return_lines_stock_return_id", table_name="stock_return_lines")
    op.drop_table("stock_return_lines")
    op.drop_index("ix_stock_returns_return_number", table_name="stock_returns")
    op.drop_index("ix_stock_returns_tenant_id", table_name="stock_returns")
    op.drop_table("stock_returns")
