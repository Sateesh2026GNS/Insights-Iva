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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "safety_incidents" not in tables:
        return

    cols = {c["name"] for c in inspector.get_columns("safety_incidents")}

    for col_name, col_type in [
        ("department", sa.String(length=128)),
        ("investigation_owner_name", sa.String(length=255)),
        ("immediate_action", sa.Text()),
        ("investigation_findings", sa.Text()),
        ("corrective_action", sa.Text()),
        ("closure_evidence", sa.Text()),
        ("corrective_action_status", sa.String(length=32)),
        ("closed_at", sa.DateTime(timezone=True)),
        ("reported_by_user_id", sa.Integer()),
        ("created_by_user_id", sa.Integer()),
    ]:
        if col_name not in cols:
            try:
                op.add_column("safety_incidents", sa.Column(col_name, col_type, nullable=True))
            except Exception:
                pass

    fks = {fk["name"] for fk in inspector.get_foreign_keys("safety_incidents")}
    if "fk_safety_incidents_reported_by_user" not in fks:
        try:
            op.create_foreign_key(
                "fk_safety_incidents_reported_by_user",
                "safety_incidents",
                "users",
                ["reported_by_user_id"],
                ["id"],
                ondelete="SET NULL",
            )
        except Exception:
            pass

    if "fk_safety_incidents_created_by_user" not in fks:
        try:
            op.create_foreign_key(
                "fk_safety_incidents_created_by_user",
                "safety_incidents",
                "users",
                ["created_by_user_id"],
                ["id"],
                ondelete="SET NULL",
            )
        except Exception:
            pass

    indexes = {ix["name"] for ix in inspector.get_indexes("safety_incidents")}
    if "ix_safety_incidents_reported_by_user_id" not in indexes:
        try:
            op.create_index(
                "ix_safety_incidents_reported_by_user_id",
                "safety_incidents",
                ["reported_by_user_id"],
            )
        except Exception:
            pass


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
