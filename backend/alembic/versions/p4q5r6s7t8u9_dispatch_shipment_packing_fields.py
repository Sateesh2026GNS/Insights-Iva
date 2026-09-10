"""Add packing fields to dispatch_shipments.

Revision ID: p4q5r6s7t8u9
Revises: o3p4q5r6s7t8
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "p4q5r6s7t8u9"
down_revision: Union[str, Sequence[str], None] = "o3p4q5r6s7t8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column("dispatch_shipments", "notes"):
        op.add_column("dispatch_shipments", sa.Column("notes", sa.Text(), nullable=True))
    if not _has_column("dispatch_shipments", "box_count"):
        op.add_column("dispatch_shipments", sa.Column("box_count", sa.Integer(), nullable=True))
    if not _has_column("dispatch_shipments", "total_weight"):
        op.add_column(
            "dispatch_shipments",
            sa.Column("total_weight", sa.Numeric(12, 2), nullable=True),
        )


def downgrade() -> None:
    if _has_column("dispatch_shipments", "total_weight"):
        op.drop_column("dispatch_shipments", "total_weight")
    if _has_column("dispatch_shipments", "box_count"):
        op.drop_column("dispatch_shipments", "box_count")
    if _has_column("dispatch_shipments", "notes"):
        op.drop_column("dispatch_shipments", "notes")
