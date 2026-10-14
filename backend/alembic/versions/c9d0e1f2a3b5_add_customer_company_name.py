"""Add company_name to customers table.

Revision ID: c9d0e1f2a3b5
Revises: c9d0e1f2a3b4
"""

from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = "c9d0e1f2a3b5"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "customers" in tables:
        if not _has_column(inspector, "customers", "company_name"):
            op.add_column("customers", sa.Column("company_name", sa.String(255), nullable=True))
        try:
            op.alter_column("customers", "name", existing_type=sa.String(255), nullable=True)
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "customers" in tables:
        if _has_column(inspector, "customers", "company_name"):
            op.drop_column("customers", "company_name")
