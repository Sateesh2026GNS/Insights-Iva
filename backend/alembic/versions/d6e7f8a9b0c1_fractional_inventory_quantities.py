"""Preserve fractional quantities in warehouse stock.

Revision ID: d6e7f8a9b0c1
Revises: c5d6e7f8a9b0
Create Date: 2026-10-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "d6e7f8a9b0c1"
down_revision: Union[str, Sequence[str], None] = "c5d6e7f8a9b0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    for table in ("inventory_items", "stock_levels", "stock_movements"):
        if table in existing_tables:
            with op.batch_alter_table(table) as batch_op:
                batch_op.alter_column(
                    "quantity",
                    existing_type=sa.Integer(),
                    type_=sa.Numeric(12, 2),
                    existing_nullable=(table == "inventory_items"),
                )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    existing_tables = set(insp.get_table_names())

    for table in ("inventory_items", "stock_levels", "stock_movements"):
        if table in existing_tables:
            with op.batch_alter_table(table) as batch_op:
                batch_op.alter_column(
                    "quantity",
                    existing_type=sa.Numeric(12, 2),
                    type_=sa.Integer(),
                    existing_nullable=(table == "inventory_items"),
                )
