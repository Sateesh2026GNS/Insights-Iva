"""Safety incident investigation and closure fields.

Revision ID: i9j0k1l2m3n4
Revises: h8i9j0k1l2m3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i9j0k1l2m3n4"
down_revision: Union[str, Sequence[str], None] = "h8i9j0k1l2m3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("safety_incidents", sa.Column("department", sa.String(length=128), nullable=True))
    op.add_column(
        "safety_incidents",
        sa.Column("investigation_owner_name", sa.String(length=255), nullable=True),
    )
    op.add_column("safety_incidents", sa.Column("immediate_action", sa.Text(), nullable=True))
    op.add_column("safety_incidents", sa.Column("investigation_findings", sa.Text(), nullable=True))
    op.add_column("safety_incidents", sa.Column("corrective_action", sa.Text(), nullable=True))
    op.add_column("safety_incidents", sa.Column("closure_evidence", sa.Text(), nullable=True))
    op.add_column(
        "safety_incidents",
        sa.Column("corrective_action_status", sa.String(length=32), nullable=True),
    )
    op.add_column("safety_incidents", sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("safety_incidents", sa.Column("reported_by_user_id", sa.Integer(), nullable=True))
    op.add_column("safety_incidents", sa.Column("created_by_user_id", sa.Integer(), nullable=True))
    op.create_foreign_key(
        "fk_safety_incidents_reported_by_user",
        "safety_incidents",
        "users",
        ["reported_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        "fk_safety_incidents_created_by_user",
        "safety_incidents",
        "users",
        ["created_by_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_safety_incidents_reported_by_user_id",
        "safety_incidents",
        ["reported_by_user_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_safety_incidents_reported_by_user_id", table_name="safety_incidents")
    op.drop_constraint("fk_safety_incidents_created_by_user", "safety_incidents", type_="foreignkey")
    op.drop_constraint("fk_safety_incidents_reported_by_user", "safety_incidents", type_="foreignkey")
    op.drop_column("safety_incidents", "created_by_user_id")
    op.drop_column("safety_incidents", "reported_by_user_id")
    op.drop_column("safety_incidents", "closed_at")
    op.drop_column("safety_incidents", "corrective_action_status")
    op.drop_column("safety_incidents", "closure_evidence")
    op.drop_column("safety_incidents", "corrective_action")
    op.drop_column("safety_incidents", "investigation_findings")
    op.drop_column("safety_incidents", "immediate_action")
    op.drop_column("safety_incidents", "investigation_owner_name")
    op.drop_column("safety_incidents", "department")
