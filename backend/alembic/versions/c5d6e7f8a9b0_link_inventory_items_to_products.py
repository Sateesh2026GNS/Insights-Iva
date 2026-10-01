"""Link inventory records to their canonical product catalog entry.

Revision ID: c5d6e7f8a9b0
Revises: b3c4d5e6f7a8
Create Date: 2026-10-01
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "c5d6e7f8a9b0"
down_revision: Union[str, Sequence[str], None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "inventory_items",
        sa.Column("product_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_inventory_items_product_id_products",
        "inventory_items",
        "products",
        ["product_id"],
        ["id"],
    )
    op.create_index(
        "ix_inventory_items_product_id", "inventory_items", ["product_id"]
    )
    op.create_index(
        "uq_inventory_items_product_id",
        "inventory_items",
        ["product_id"],
        unique=True,
    )

    # Backfill only unambiguous tenant/SKU matches. Duplicate legacy inventory
    # rows are left unlinked for manual reconciliation rather than guessed.
    op.execute(
        sa.text(
            """
            UPDATE inventory_items
            SET product_id = (
                SELECT MIN(products.id)
                FROM products
                WHERE products.tenant_id = inventory_items.tenant_id
                  AND products.sku = inventory_items.sku
            )
            WHERE inventory_items.product_id IS NULL
              AND (
                SELECT COUNT(*)
                FROM products
                WHERE products.tenant_id = inventory_items.tenant_id
                  AND products.sku = inventory_items.sku
              ) = 1
              AND (
                SELECT COUNT(*)
                FROM inventory_items AS matching_items
                WHERE matching_items.tenant_id = inventory_items.tenant_id
                  AND matching_items.sku = inventory_items.sku
              ) = 1
            """
        )
    )


def downgrade() -> None:
    op.drop_index("uq_inventory_items_product_id", table_name="inventory_items")
    op.drop_index("ix_inventory_items_product_id", table_name="inventory_items")
    op.drop_constraint(
        "fk_inventory_items_product_id_products", "inventory_items", type_="foreignkey"
    )
    op.drop_column("inventory_items", "product_id")
