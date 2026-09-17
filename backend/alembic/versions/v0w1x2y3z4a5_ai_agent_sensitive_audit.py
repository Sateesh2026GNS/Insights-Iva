"""AI agent log — elevated tool sensitive targets.

Revision ID: v0w1x2y3z4a5
Revises: u9v0w1x2y3z4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "v0w1x2y3z4a5"
down_revision: Union[str, Sequence[str], None] = "u9v0w1x2y3z4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ai_agent_log", sa.Column("tool_sensitivity", sa.String(length=16), nullable=True))
    op.add_column(
        "ai_agent_log",
        sa.Column("sensitive_targets", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ai_agent_log", "sensitive_targets")
    op.drop_column("ai_agent_log", "tool_sensitivity")
