"""Godown toolkit tables and stock adjustment remarks.

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7

Does not copy stock, invent costs, or change existing quantities.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "d3e4f5a6b7c8"
down_revision: Union[str, Sequence[str], None] = "c2d3e4f5a6b7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create(name: str, *columns, **kwargs) -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if name in inspector.get_table_names():
        return
    op.create_table(name, *columns, **kwargs)


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "stock_adjustments" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("stock_adjustments")}
        if "remarks" not in cols:
            op.add_column("stock_adjustments", sa.Column("remarks", sa.Text(), nullable=True))

    _create(
        "item_physical_profiles",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("weight_kg_per_unit", sa.Numeric(14, 4)),
        sa.Column("volume_cft_per_unit", sa.Numeric(14, 4)),
        sa.Column("units_per_stack", sa.Numeric(14, 4)),
        sa.Column("stack_area_sqft", sa.Numeric(14, 4)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("item_id", name="uq_item_physical_profiles_item"),
    )
    _create(
        "warehouse_layouts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("length_ft", sa.Numeric(12, 2)),
        sa.Column("breadth_ft", sa.Numeric(12, 2)),
        sa.Column("clear_height_ft", sa.Numeric(12, 2)),
        sa.Column("aisle_pct", sa.Numeric(5, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("warehouse_id", name="uq_warehouse_layouts_warehouse"),
    )
    _create(
        "godown_labour_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id")),
        sa.Column("work_date", sa.Date(), nullable=False),
        sa.Column("work_type", sa.String(64), nullable=False),
        sa.Column("basis", sa.String(16), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 2), nullable=False),
        sa.Column("rate", sa.Numeric(14, 2), nullable=False),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.Column("is_estimate", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("reference", sa.String(128)),
        sa.Column("remarks", sa.Text()),
        sa.Column("client_request_id", sa.String(64)),
        sa.Column("created_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "client_request_id", name="uq_godown_labour_client_request"),
    )
    _create(
        "truck_load_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id"), nullable=False),
        sa.Column("vehicle_label", sa.String(128), nullable=False),
        sa.Column("capacity_kg", sa.Numeric(14, 2)),
        sa.Column("capacity_cft", sa.Numeric(14, 2)),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("weight_status", sa.String(32), nullable=False),
        sa.Column("volume_status", sa.String(32), nullable=False),
        sa.Column("total_units", sa.Numeric(14, 2), nullable=False),
        sa.Column("total_kg", sa.Numeric(14, 2)),
        sa.Column("total_cft", sa.Numeric(14, 2)),
        sa.Column("client_request_id", sa.String(64)),
        sa.Column("created_by", sa.String(255)),
        sa.Column("notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "client_request_id", name="uq_truck_load_plans_client_request"),
    )
    _create(
        "truck_load_plan_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("plan_id", sa.Integer(), sa.ForeignKey("truck_load_plans.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 2), nullable=False),
        sa.Column("weight_kg", sa.Numeric(14, 2)),
        sa.Column("volume_cft", sa.Numeric(14, 2)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    _create(
        "storage_quotations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("quote_number", sa.String(64), nullable=False),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id")),
        sa.Column("quote_date", sa.Date(), nullable=False),
        sa.Column("valid_until", sa.Date()),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("subtotal", sa.Numeric(14, 2), nullable=False),
        sa.Column("discount", sa.Numeric(14, 2), nullable=False, server_default="0"),
        sa.Column("tax_pct", sa.Numeric(6, 2)),
        sa.Column("tax_amount", sa.Numeric(14, 2)),
        sa.Column("tax_status", sa.String(32), nullable=False),
        sa.Column("tax_source", sa.String(32)),
        sa.Column("total", sa.Numeric(14, 2), nullable=False),
        sa.Column("notes", sa.Text()),
        sa.Column("client_request_id", sa.String(64)),
        sa.Column("created_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "quote_number", name="uq_storage_quotations_tenant_number"),
        sa.UniqueConstraint("tenant_id", "client_request_id", name="uq_storage_quotations_client_request"),
    )
    _create(
        "storage_quotation_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("quotation_id", sa.Integer(), sa.ForeignKey("storage_quotations.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("inventory_items.id")),
        sa.Column("description", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 2), nullable=False),
        sa.Column("rate", sa.Numeric(14, 2), nullable=False),
        sa.Column("amount", sa.Numeric(14, 2), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    _create(
        "gate_passes",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("document_no", sa.String(64), nullable=False),
        sa.Column("document_type", sa.String(32), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
        sa.Column("document_date", sa.Date(), nullable=False),
        sa.Column("warehouse_id", sa.Integer(), sa.ForeignKey("warehouses.id")),
        sa.Column("customer_id", sa.Integer(), sa.ForeignKey("customers.id")),
        sa.Column("party_name", sa.String(255)),
        sa.Column("vehicle_no", sa.String(64)),
        sa.Column("driver_name", sa.String(255)),
        sa.Column("driver_phone", sa.String(64)),
        sa.Column("purpose", sa.String(255)),
        sa.Column("reference", sa.String(128)),
        sa.Column("remarks", sa.Text()),
        sa.Column("client_request_id", sa.String(64)),
        sa.Column("created_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "document_no", name="uq_gate_passes_tenant_document"),
        sa.UniqueConstraint("tenant_id", "client_request_id", name="uq_gate_passes_client_request"),
    )
    _create(
        "gate_pass_lines",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("gate_pass_id", sa.Integer(), sa.ForeignKey("gate_passes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("line_no", sa.Integer(), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("quantity", sa.Numeric(14, 2), nullable=False),
        sa.Column("unit", sa.String(32), nullable=False),
        sa.Column("weight_kg", sa.Numeric(14, 2)),
        sa.Column("remark", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    _create(
        "eoq_calculations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("tenant_id", sa.Integer(), sa.ForeignKey("tenants.id"), nullable=False),
        sa.Column("item_id", sa.Integer(), sa.ForeignKey("inventory_items.id"), nullable=False),
        sa.Column("annual_demand", sa.Numeric(14, 2), nullable=False),
        sa.Column("demand_source", sa.String(32), nullable=False),
        sa.Column("order_cost", sa.Numeric(14, 2), nullable=False),
        sa.Column("order_cost_source", sa.String(32), nullable=False),
        sa.Column("holding_pct", sa.Numeric(8, 4)),
        sa.Column("unit_cost", sa.Numeric(14, 4)),
        sa.Column("unit_cost_source", sa.String(32)),
        sa.Column("holding_cost_per_unit", sa.Numeric(14, 4), nullable=False),
        sa.Column("eoq", sa.Numeric(14, 2), nullable=False),
        sa.Column("client_request_id", sa.String(64)),
        sa.Column("created_by", sa.String(255)),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("tenant_id", "client_request_id", name="uq_eoq_calculations_client_request"),
    )


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    for name in (
        "eoq_calculations",
        "gate_pass_lines",
        "gate_passes",
        "storage_quotation_lines",
        "storage_quotations",
        "truck_load_plan_lines",
        "truck_load_plans",
        "godown_labour_entries",
        "warehouse_layouts",
        "item_physical_profiles",
    ):
        if name in tables:
            op.drop_table(name)
    inspector = sa.inspect(bind)
    if "stock_adjustments" in inspector.get_table_names():
        cols = {c["name"] for c in inspector.get_columns("stock_adjustments")}
        if "remarks" in cols:
            op.drop_column("stock_adjustments", "remarks")
