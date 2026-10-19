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
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if "export_packing_lists" not in tables:
        return

    cols = {c["name"] for c in insp.get_columns("export_packing_lists")}
    if "dispatch_shipment_id" not in cols:
        op.add_column(
            "export_packing_lists",
            sa.Column("dispatch_shipment_id", sa.Integer(), nullable=True),
        )

    if "dispatch_shipments" in tables:
        existing_fks = {fk.get("name") for fk in insp.get_foreign_keys("export_packing_lists")}
        if "fk_export_packing_lists_dispatch_shipment" not in existing_fks:
            try:
                op.create_foreign_key(
                    "fk_export_packing_lists_dispatch_shipment",
                    "export_packing_lists",
                    "dispatch_shipments",
                    ["dispatch_shipment_id"],
                    ["id"],
                    ondelete="SET NULL",
                )
            except Exception:
                pass

    existing_indexes = {ix.get("name") for ix in insp.get_indexes("export_packing_lists")}
    if "ix_export_packing_lists_dispatch_shipment_id" not in existing_indexes:
        try:
            op.create_index(
                "ix_export_packing_lists_dispatch_shipment_id",
                "export_packing_lists",
                ["dispatch_shipment_id"],
            )
        except Exception:
            pass

    if "document_checklist_json" not in cols:
        try:
            op.add_column("export_packing_lists", sa.Column("document_checklist_json", sa.Text(), nullable=True))
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    tables = set(insp.get_table_names())
    if "export_packing_lists" not in tables:
        return

    cols = {c["name"] for c in insp.get_columns("export_packing_lists")}
    if "document_checklist_json" in cols:
        try:
            op.drop_column("export_packing_lists", "document_checklist_json")
        except Exception:
            pass
    if "dispatch_shipment_id" in cols:
        existing_indexes = {ix.get("name") for ix in insp.get_indexes("export_packing_lists")}
        if "ix_export_packing_lists_dispatch_shipment_id" in existing_indexes:
            try:
                op.drop_index("ix_export_packing_lists_dispatch_shipment_id", table_name="export_packing_lists")
            except Exception:
                pass
        existing_fks = {fk.get("name") for fk in insp.get_foreign_keys("export_packing_lists")}
        if "fk_export_packing_lists_dispatch_shipment" in existing_fks:
            try:
                op.drop_constraint("fk_export_packing_lists_dispatch_shipment", "export_packing_lists", type_="foreignkey")
            except Exception:
                pass
        try:
            op.drop_column("export_packing_lists", "dispatch_shipment_id")
        except Exception:
            pass

