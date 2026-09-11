"""Add sales order customer-cancellation metadata fields.

Revision ID: q5r6s7t8u9v0
Revises: p4q5r6s7t8u9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "q5r6s7t8u9v0"
down_revision: Union[str, Sequence[str], None] = "p4q5r6s7t8u9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column("sales_orders", "cancellation_reason"):
        op.add_column("sales_orders", sa.Column("cancellation_reason", sa.Text(), nullable=True))
    if not _has_column("sales_orders", "cancellation_type"):
        op.add_column(
            "sales_orders",
            sa.Column("cancellation_type", sa.String(length=32), nullable=True),
        )
    if not _has_column("sales_orders", "cancelled_by_user_id"):
        op.add_column(
            "sales_orders",
            sa.Column("cancelled_by_user_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_sales_orders_cancelled_by_user_id",
            "sales_orders",
            "users",
            ["cancelled_by_user_id"],
            ["id"],
        )
    if not _has_column("sales_orders", "cancelled_at"):
        op.add_column(
            "sales_orders",
            sa.Column("cancelled_at", sa.DateTime(timezone=True), nullable=True),
        )
        op.create_index(
            "ix_sales_orders_cancelled_at",
            "sales_orders",
            ["cancelled_at"],
            unique=False,
        )


def downgrade() -> None:
    if _has_column("sales_orders", "cancelled_at"):
        op.drop_index("ix_sales_orders_cancelled_at", table_name="sales_orders")
        op.drop_column("sales_orders", "cancelled_at")
    if _has_column("sales_orders", "cancelled_by_user_id"):
        op.drop_constraint("fk_sales_orders_cancelled_by_user_id", "sales_orders", type_="foreignkey")
        op.drop_column("sales_orders", "cancelled_by_user_id")
    if _has_column("sales_orders", "cancellation_type"):
        op.drop_column("sales_orders", "cancellation_type")
    if _has_column("sales_orders", "cancellation_reason"):
        op.drop_column("sales_orders", "cancellation_reason")
