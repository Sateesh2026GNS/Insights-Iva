"""distributed rate limit buckets for multi-instance auth/report limits

Revision ID: a5b6c7d8e9f0
Revises: z4a5b6c7d8e9
Create Date: 2026-10-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a5b6c7d8e9f0"
down_revision: Union[str, None] = "z4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "rate_limit_buckets",
        sa.Column("bucket_key", sa.String(length=512), nullable=False),
        sa.Column("window_start_epoch", sa.Integer(), nullable=False),
        sa.Column("hit_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("bucket_key"),
    )
    op.create_index(
        "ix_rate_limit_buckets_window_start_epoch",
        "rate_limit_buckets",
        ["window_start_epoch"],
    )


def downgrade() -> None:
    op.drop_index("ix_rate_limit_buckets_window_start_epoch", table_name="rate_limit_buckets")
    op.drop_table("rate_limit_buckets")
