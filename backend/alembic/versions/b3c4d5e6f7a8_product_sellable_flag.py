"""Add explicit sellable flag to products.

Revision ID: b3c4d5e6f7a8
Revises: a2b3c4d5e6f7
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b3c4d5e6f7a8"
down_revision: Union[str, None] = "a2b3c4d5e6f7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "products" not in inspector.get_table_names():
        return

    columns = {column["name"] for column in inspector.get_columns("products")}
    if "is_sellable" not in columns:
        op.add_column(
            "products",
            sa.Column("is_sellable", sa.Boolean(), nullable=False, server_default=sa.false()),
        )

    # Keep established finished goods available to quote; other product types
    # require an explicit opt-in because categories alone do not determine saleability.
    op.execute(
        "UPDATE products SET is_sellable = "
        "CASE WHEN lower(trim(coalesce(category, ''))) IN "
        "('finished goods', 'finished good', 'service', 'services') "
        "THEN TRUE ELSE FALSE END"
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "products" in inspector.get_table_names():
        columns = {column["name"] for column in inspector.get_columns("products")}
        if "is_sellable" in columns:
            op.drop_column("products", "is_sellable")
