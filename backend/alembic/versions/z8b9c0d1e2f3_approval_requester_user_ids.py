"""Persist submitter identities for approval request notifications.

Revision ID: z8b9c0d1e2f3
Revises: z7a8b9c0d1e2, d3e4f5a6b7c8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = (
    "z7a8b9c0d1e2",
    "d3e4f5a6b7c8",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = (
    "suppliers",
    "purchase_orders",
    "material_requests",
    "stock_adjustments",
    "production_orders",
)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    for table in TABLES:
        if table not in tables:
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "submitted_by_user_id" in columns:
            continue
        op.add_column(
            table,
            sa.Column(
                "submitted_by_user_id",
                sa.Integer(),
                sa.ForeignKey("users.id", ondelete="SET NULL"),
                nullable=True,
            ),
        )
        op.create_index(
            f"ix_{table}_submitted_by_user_id",
            table,
            ["submitted_by_user_id"],
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    tables = set(inspector.get_table_names())
    for table in TABLES:
        if table not in tables:
            continue
        columns = {column["name"] for column in inspector.get_columns(table)}
        if "submitted_by_user_id" not in columns:
            continue
        indexes = {index["name"] for index in inspector.get_indexes(table)}
        index_name = f"ix_{table}_submitted_by_user_id"
        if index_name in indexes:
            op.drop_index(index_name, table_name=table)
        with op.batch_alter_table(table) as batch_op:
            batch_op.drop_column("submitted_by_user_id")
