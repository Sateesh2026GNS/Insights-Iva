"""distributed rate limit buckets for multi-instance auth/report limits

Revision ID: e1f2a3b4c5d6
Revises: b6c7d8e9f0a1
Create Date: 2026-10-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, None] = "b6c7d8e9f0a1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "rate_limit_buckets" not in existing_tables:
        op.create_table(
            "rate_limit_buckets",
            sa.Column("bucket_key", sa.String(length=512), nullable=False),
            sa.Column("window_start_epoch", sa.Integer(), nullable=False),
            sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.PrimaryKeyConstraint("bucket_key"),
        )
    
    existing_indices = [i["name"] for i in inspector.get_indexes("rate_limit_buckets")] if "rate_limit_buckets" in (existing_tables if "rate_limit_buckets" not in existing_tables else inspector.get_table_names()) else []
    if "ix_rate_limit_buckets_window_start_epoch" not in existing_indices:
        op.create_index(
            "ix_rate_limit_buckets_window_start_epoch",
            "rate_limit_buckets",
            ["window_start_epoch"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    existing_tables = inspector.get_table_names()

    if "rate_limit_buckets" in existing_tables:
        existing_indices = [i["name"] for i in inspector.get_indexes("rate_limit_buckets")]
        if "ix_rate_limit_buckets_window_start_epoch" in existing_indices:
            op.drop_index("ix_rate_limit_buckets_window_start_epoch", table_name="rate_limit_buckets")
        op.drop_table("rate_limit_buckets")
