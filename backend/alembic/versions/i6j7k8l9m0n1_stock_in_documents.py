"""Add stock_in_documents and stock_in_lines tables.

Revision ID: i6j7k8l9m0n1
Revises: h5i6j7k8l9m0
Create Date: 2026-08-24 14:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "i6j7k8l9m0n1"
down_revision: Union[str, Sequence[str], None] = "h5i6j7k8l9m0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    tables = set(inspect(bind).get_table_names())

    if "stock_in_documents" not in tables:
        op.create_table(
            "stock_in_documents",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("stock_in_number", sa.String(length=64), nullable=False),
            sa.Column("stock_in_date", sa.Date(), nullable=True),
            sa.Column("reference_type", sa.String(length=64), nullable=False),
            sa.Column("reference_no", sa.String(length=128), nullable=True),
            sa.Column("reference_id", sa.Integer(), nullable=True),
            sa.Column("supplier_id", sa.Integer(), nullable=True),
            sa.Column("supplier_name", sa.String(length=255), nullable=True),
            sa.Column("warehouse_id", sa.Integer(), nullable=False),
            sa.Column("storage_location", sa.String(length=128), nullable=True),
            sa.Column("received_by", sa.String(length=255), nullable=True),
            sa.Column("received_by_user_id", sa.Integer(), nullable=True),
            sa.Column("remarks", sa.Text(), nullable=True),
            sa.Column("attachments_json", sa.Text(), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
            sa.Column("total_qty", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("created_by", sa.String(length=255), nullable=True),
            sa.Column("updated_by", sa.String(length=255), nullable=True),
            sa.Column("confirmed_by", sa.String(length=255), nullable=True),
            sa.Column("confirmed_at", sa.Date(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["supplier_id"], ["suppliers.id"]),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["warehouse_id"], ["warehouses.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_stock_in_documents_tenant_id", "stock_in_documents", ["tenant_id"])
        op.create_index("ix_stock_in_documents_stock_in_number", "stock_in_documents", ["stock_in_number"])

    if "stock_in_lines" not in tables:
        op.create_table(
            "stock_in_lines",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("stock_in_id", sa.Integer(), nullable=False),
            sa.Column("line_no", sa.Integer(), nullable=False),
            sa.Column("item_id", sa.Integer(), nullable=False),
            sa.Column("ordered_qty", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("received_qty", sa.Integer(), nullable=False),
            sa.Column("unit", sa.String(length=32), nullable=False, server_default="pcs"),
            sa.Column("batch_number", sa.String(length=64), nullable=True),
            sa.Column("lot_number", sa.String(length=64), nullable=True),
            sa.Column("manufacturing_date", sa.Date(), nullable=True),
            sa.Column("expiry_date", sa.Date(), nullable=True),
            sa.Column("storage_location", sa.String(length=128), nullable=True),
            sa.Column("line_remarks", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["item_id"], ["inventory_items.id"]),
            sa.ForeignKeyConstraint(["stock_in_id"], ["stock_in_documents.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_stock_in_lines_stock_in_id", "stock_in_lines", ["stock_in_id"])


def downgrade() -> None:
    op.drop_index("ix_stock_in_lines_stock_in_id", table_name="stock_in_lines")
    op.drop_table("stock_in_lines")
    op.drop_index("ix_stock_in_documents_stock_in_number", table_name="stock_in_documents")
    op.drop_index("ix_stock_in_documents_tenant_id", table_name="stock_in_documents")
    op.drop_table("stock_in_documents")
