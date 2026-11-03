"""Per-user alert read receipts.

Revision ID: b1c2d3e4f5a6
Revises: a8b9c0d1e2f3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "b1c2d3e4f5a6"
down_revision: Union[str, Sequence[str], None] = "a8b9c0d1e2f3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "alert_reads" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "alert_reads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("alert_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("read_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["alert_id"], ["alerts.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("alert_id", "user_id", name="uq_alert_reads_alert_user"),
    )
    op.create_index("ix_alert_reads_alert_id", "alert_reads", ["alert_id"])
    op.create_index("ix_alert_reads_user_id", "alert_reads", ["user_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if "alert_reads" not in sa.inspect(bind).get_table_names():
        return
    op.drop_index("ix_alert_reads_user_id", table_name="alert_reads")
    op.drop_index("ix_alert_reads_alert_id", table_name="alert_reads")
    op.drop_table("alert_reads")
