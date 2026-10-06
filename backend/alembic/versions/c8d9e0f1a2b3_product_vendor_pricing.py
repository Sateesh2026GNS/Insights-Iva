"""product vendor pricing on products master

Revision ID: c8d9e0f1a2b3
Revises: f2a3b4c5d6e7
Create Date: 2026-10-06
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c8d9e0f1a2b3"
down_revision: Union[str, None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "product_vendor_pricing",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=False),
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
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "tenant_id",
            "product_id",
            "supplier_id",
            name="uq_product_vendor_pricing_tenant_product_vendor",
        ),
    )
    op.create_index(
        "ix_product_vendor_pricing_tenant_active",
        "product_vendor_pricing",
        ["tenant_id", "is_active"],
    )
    op.create_index(
        op.f("ix_product_vendor_pricing_product_id"),
        "product_vendor_pricing",
        ["product_id"],
    )
    op.create_index(
        op.f("ix_product_vendor_pricing_supplier_id"),
        "product_vendor_pricing",
        ["supplier_id"],
    )
    op.create_index(
        op.f("ix_product_vendor_pricing_tenant_id"),
        "product_vendor_pricing",
        ["tenant_id"],
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_product_vendor_pricing_tenant_id"), table_name="product_vendor_pricing")
    op.drop_index(op.f("ix_product_vendor_pricing_supplier_id"), table_name="product_vendor_pricing")
    op.drop_index(op.f("ix_product_vendor_pricing_product_id"), table_name="product_vendor_pricing")
    op.drop_index("ix_product_vendor_pricing_tenant_active", table_name="product_vendor_pricing")
    op.drop_table("product_vendor_pricing")
