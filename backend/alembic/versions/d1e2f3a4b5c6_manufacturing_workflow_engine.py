"""Add manufacturing workflow engine columns and tables.

Revision ID: d1e2f3a4b5c6
Revises: c4d5e6f7a8b9
Create Date: 2026-08-17 18:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d1e2f3a4b5c6"
down_revision: Union[str, Sequence[str], None] = "c4d5e6f7a8b9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "sales_orders",
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
    )
    op.add_column(
        "sales_orders",
        sa.Column("workflow_status", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_sales_orders_workflow_status",
        "sales_orders",
        ["workflow_status"],
        unique=False,
    )

    op.create_table(
        "sales_order_material_checks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("check_number", sa.String(length=64), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
        sa.Column("verified_by_user_id", sa.Integer(), nullable=True),
        sa.Column("verified_by_name", sa.String(length=255), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["sales_order_id"], ["sales_orders.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["verified_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sales_order_material_checks_tenant_id",
        "sales_order_material_checks",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_sales_order_material_checks_sales_order_id",
        "sales_order_material_checks",
        ["sales_order_id"],
        unique=False,
    )

    op.create_table(
        "sales_order_material_check_lines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("material_check_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("inventory_item_id", sa.Integer(), nullable=True),
        sa.Column("material_name", sa.String(length=255), nullable=False),
        sa.Column("required_qty", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("available_qty", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("shortage_qty", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
        sa.Column("stock_location", sa.String(length=255), nullable=True),
        sa.Column("is_available", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"]),
        sa.ForeignKeyConstraint(["material_check_id"], ["sales_order_material_checks.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_sales_order_material_check_lines_material_check_id",
        "sales_order_material_check_lines",
        ["material_check_id"],
        unique=False,
    )

    op.create_table(
        "manufacturing_workflow_transitions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("previous_status", sa.String(length=64), nullable=True),
        sa.Column("new_status", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=True),
        sa.Column("user_name", sa.String(length=255), nullable=True),
        sa.Column("user_role", sa.String(length=255), nullable=True),
        sa.Column("team", sa.String(length=64), nullable=True),
        sa.Column("work_order_id", sa.Integer(), nullable=True),
        sa.Column("quality_inspection_id", sa.Integer(), nullable=True),
        sa.Column("dispatch_id", sa.Integer(), nullable=True),
        sa.Column("invoice_id", sa.Integer(), nullable=True),
        sa.Column("details", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["dispatch_id"], ["dispatch_shipments.id"]),
        sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
        sa.ForeignKeyConstraint(["quality_inspection_id"], ["quality_inspections.id"]),
        sa.ForeignKeyConstraint(["sales_order_id"], ["sales_orders.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_manufacturing_workflow_transitions_tenant_id",
        "manufacturing_workflow_transitions",
        ["tenant_id"],
        unique=False,
    )
    op.create_index(
        "ix_manufacturing_workflow_transitions_sales_order_id",
        "manufacturing_workflow_transitions",
        ["sales_order_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_manufacturing_workflow_transitions_sales_order_id", table_name="manufacturing_workflow_transitions")
    op.drop_index("ix_manufacturing_workflow_transitions_tenant_id", table_name="manufacturing_workflow_transitions")
    op.drop_table("manufacturing_workflow_transitions")

    op.drop_index("ix_sales_order_material_check_lines_material_check_id", table_name="sales_order_material_check_lines")
    op.drop_table("sales_order_material_check_lines")

    op.drop_index("ix_sales_order_material_checks_sales_order_id", table_name="sales_order_material_checks")
    op.drop_index("ix_sales_order_material_checks_tenant_id", table_name="sales_order_material_checks")
    op.drop_table("sales_order_material_checks")

    op.drop_index("ix_sales_orders_workflow_status", table_name="sales_orders")
    op.drop_column("sales_orders", "workflow_status")
    op.drop_column("sales_orders", "priority")
