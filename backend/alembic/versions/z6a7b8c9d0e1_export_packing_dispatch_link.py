"""Link export packing lists to dispatch shipments + document checklist JSON.

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "y5z6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    if not _has_column("export_packing_lists", "dispatch_shipment_id"):
        op.add_column(
            "export_packing_lists",
            sa.Column("dispatch_shipment_id", sa.Integer(), nullable=True),
        )
        op.create_foreign_key(
            "fk_export_packing_lists_dispatch_shipment",
            "export_packing_lists",
            "dispatch_shipments",
            ["dispatch_shipment_id"],
            ["id"],
            ondelete="SET NULL",
        )
        op.create_index(
            "ix_export_packing_lists_dispatch_shipment_id",
            "export_packing_lists",
            ["dispatch_shipment_id"],
        )
    if not _has_column("export_packing_lists", "document_checklist_json"):
        op.add_column("export_packing_lists", sa.Column("document_checklist_json", sa.Text(), nullable=True))


def downgrade() -> None:
    if _has_column("export_packing_lists", "document_checklist_json"):
        op.drop_column("export_packing_lists", "document_checklist_json")
    if _has_column("export_packing_lists", "dispatch_shipment_id"):
        op.drop_index("ix_export_packing_lists_dispatch_shipment_id", table_name="export_packing_lists")
        op.drop_constraint("fk_export_packing_lists_dispatch_shipment", "export_packing_lists", type_="foreignkey")
        op.drop_column("export_packing_lists", "dispatch_shipment_id")
