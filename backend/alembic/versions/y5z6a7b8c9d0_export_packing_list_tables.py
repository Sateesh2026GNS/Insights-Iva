"""Export packing list generator tables.

Revision ID: y5z6a7b8c9d0
Revises: i9j0k1l2m3n4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "y5z6a7b8c9d0"
down_revision: Union[str, Sequence[str], None] = "i9j0k1l2m3n4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "export_packing_lists",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("packing_list_no", sa.String(length=64), nullable=False),
        sa.Column("shipment_no", sa.String(length=64), nullable=False),
        sa.Column("destination", sa.String(length=255), nullable=True),
        sa.Column("container_no", sa.String(length=64), nullable=True),
        sa.Column("dispatch_date", sa.Date(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("gross_weight_kg", sa.Numeric(14, 2), nullable=True),
        sa.Column("net_weight_kg", sa.Numeric(14, 2), nullable=True),
        sa.Column("cartons_planned", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("cartons_prepared", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("remarks", sa.Text(), nullable=True),
        sa.Column("prepared_by_name", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "packing_list_no", name="uq_export_packing_lists_tenant_no"),
    )
    op.create_index("ix_export_packing_lists_tenant_id", "export_packing_lists", ["tenant_id"])
    op.create_index("ix_export_packing_lists_shipment_no", "export_packing_lists", ["shipment_no"])

    op.create_table(
        "export_packing_list_cartons",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("packing_list_id", sa.Integer(), nullable=False),
        sa.Column("carton_no", sa.String(length=32), nullable=False),
        sa.Column("sku_code", sa.String(length=64), nullable=True),
        sa.Column("item_description", sa.String(length=512), nullable=False),
        sa.Column("qty_pcs", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("net_weight_kg", sa.Numeric(12, 2), nullable=True),
        sa.Column("gross_weight_kg", sa.Numeric(12, 2), nullable=True),
        sa.Column("dim_length_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("dim_width_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("dim_height_cm", sa.Numeric(8, 2), nullable=True),
        sa.Column("marks_numbers", sa.String(length=255), nullable=True),
        sa.Column("package_type", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["packing_list_id"], ["export_packing_lists.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_export_packing_cartons_list_id", "export_packing_list_cartons", ["packing_list_id"])
    op.create_index("ix_export_packing_cartons_tenant_id", "export_packing_list_cartons", ["tenant_id"])


def downgrade() -> None:
    op.drop_table("export_packing_list_cartons")
    op.drop_table("export_packing_lists")
