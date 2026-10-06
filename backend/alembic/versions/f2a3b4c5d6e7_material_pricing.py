"""material pricing landed cost and selling prices

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-10-05
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f2a3b4c5d6e7"
down_revision: Union[str, None] = "e1f2a3b4c5d6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "material_pricing",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("inventory_item_id", sa.Integer(), nullable=False),
        sa.Column("supplier_id", sa.Integer(), nullable=False),
        sa.Column("purchase_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("transport_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("labour_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("import_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("total_landed_cost", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("minimum_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("maximum_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("selling_price", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("currency", sa.String(length=16), nullable=False, server_default="INR"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("created_by", sa.String(length=255), nullable=True),
        sa.Column("updated_by", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "inventory_item_id",
            "supplier_id",
            name="uq_material_pricing_tenant_item_vendor",
        ),
    )
    op.create_index("ix_material_pricing_tenant_id", "material_pricing", ["tenant_id"])
    op.create_index(
        "ix_material_pricing_tenant_active",
        "material_pricing",
        ["tenant_id", "is_active"],
    )
    op.create_index(
        "ix_material_pricing_inventory_item_id", "material_pricing", ["inventory_item_id"]
    )
    op.create_index("ix_material_pricing_supplier_id", "material_pricing", ["supplier_id"])


def downgrade() -> None:
    op.drop_index("ix_material_pricing_supplier_id", table_name="material_pricing")
    op.drop_index("ix_material_pricing_inventory_item_id", table_name="material_pricing")
    op.drop_index("ix_material_pricing_tenant_active", table_name="material_pricing")
    op.drop_index("ix_material_pricing_tenant_id", table_name="material_pricing")
    op.drop_table("material_pricing")
