"""Work chat per-member clear boundary.

Revision ID: e1f2a3b4c5d6
Revises: d0e1f2a3b4c5
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e1f2a3b4c5d6"
down_revision: Union[str, Sequence[str], None] = "d0e1f2a3b4c5"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("work_chat_members")}
    if "cleared_before_message_id" not in cols:
        op.add_column(
            "work_chat_members",
            sa.Column("cleared_before_message_id", sa.Integer(), nullable=True),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    cols = {c["name"] for c in insp.get_columns("work_chat_members")}
    if "cleared_before_message_id" in cols:
        op.drop_column("work_chat_members", "cleared_before_message_id")
