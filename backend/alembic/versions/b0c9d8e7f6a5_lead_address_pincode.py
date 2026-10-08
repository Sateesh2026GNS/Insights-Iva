"""Lead address and pincode.

Revision ID: b0c9d8e7f6a5
Revises: a9b8c7d6e5f4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b0c9d8e7f6a5"
down_revision: Union[str, None] = "a9b8c7d6e5f4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, column: str) -> bool:
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    inspector = inspect(bind)
    if "leads" not in set(inspector.get_table_names()):
        return
    if not _has_column(inspector, "leads", "address"):
        op.add_column("leads", sa.Column("address", sa.Text(), nullable=True))
    if not _has_column(inspector, "leads", "pincode"):
        op.add_column("leads", sa.Column("pincode", sa.String(length=16), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    inspector = inspect(bind)
    if "leads" not in set(inspector.get_table_names()):
        return
    if _has_column(inspector, "leads", "pincode"):
        op.drop_column("leads", "pincode")
    if _has_column(inspector, "leads", "address"):
        op.drop_column("leads", "address")
