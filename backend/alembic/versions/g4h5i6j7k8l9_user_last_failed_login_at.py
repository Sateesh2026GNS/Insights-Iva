"""Add users.last_failed_login_at for login lockout audit metadata.

Revision ID: g4h5i6j7k8l9
Revises: f3a4b5c6d7e8
Create Date: 2026-08-21 16:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "g4h5i6j7k8l9"
down_revision: Union[str, Sequence[str], None] = "f3a4b5c6d7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "users" in tables:
        cols = {c["name"] for c in inspector.get_columns("users")}
        if "last_failed_login_at" not in cols:
            op.add_column(
                "users",
                sa.Column("last_failed_login_at", sa.DateTime(timezone=True), nullable=True),
            )


def downgrade() -> None:
    op.drop_column("users", "last_failed_login_at")
