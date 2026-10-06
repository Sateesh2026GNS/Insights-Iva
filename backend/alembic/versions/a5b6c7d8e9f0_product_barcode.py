"""Store product barcodes separately from SKUs."""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a5b6c7d8e9f0"
down_revision: Union[str, Sequence[str], None] = "z4a5b6c7d8e9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    product_columns = {
        column["name"] for column in sa.inspect(bind).get_columns("products")
    }
    if "barcode" not in product_columns:
        op.add_column(
            "products", sa.Column("barcode", sa.String(length=128), nullable=True)
        )
    linked_rows = list(bind.execute(
        sa.text(
            "SELECT i.id AS inventory_id, i.tenant_id, p.id AS product_id, p.sku, p.barcode "
            "FROM inventory_items i JOIN products p ON p.id = i.product_id "
            "WHERE i.tenant_id = p.tenant_id AND p.sku IS NOT NULL AND TRIM(p.sku) <> ''"
        )
    ).mappings())
    for row in linked_rows:
        product_count = bind.execute(
            sa.text(
                "SELECT COUNT(*) FROM products WHERE tenant_id = :tenant_id AND LOWER(sku) = LOWER(:sku)"
            ),
            {"tenant_id": row["tenant_id"], "sku": row["sku"]},
        ).scalar_one()
        inventory_count = bind.execute(
            sa.text(
                "SELECT COUNT(*) FROM inventory_items "
                "WHERE tenant_id = :tenant_id AND LOWER(sku) = LOWER(:sku) AND id <> :inventory_id"
            ),
            {
                "tenant_id": row["tenant_id"],
                "sku": row["sku"],
                "inventory_id": row["inventory_id"],
            },
        ).scalar_one()
        if product_count == 1 and inventory_count == 0:
            bind.execute(
                sa.text(
                    "UPDATE inventory_items SET sku = :sku, barcode = :barcode WHERE id = :inventory_id"
                ),
                {
                    "sku": row["sku"],
                    "barcode": row["barcode"],
                    "inventory_id": row["inventory_id"],
                },
            )


def downgrade() -> None:
    bind = op.get_bind()
    product_columns = {
        column["name"] for column in sa.inspect(bind).get_columns("products")
    }
    if "barcode" in product_columns:
        op.drop_column("products", "barcode")
