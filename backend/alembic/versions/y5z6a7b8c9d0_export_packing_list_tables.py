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
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "export_packing_lists" not in tables:
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
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("export_packing_lists")}
        columns_to_ensure = [
            ("tenant_id", sa.Column("tenant_id", sa.Integer(), nullable=False)),
            ("packing_list_no", sa.Column("packing_list_no", sa.String(length=64), nullable=False)),
            ("shipment_no", sa.Column("shipment_no", sa.String(length=64), nullable=False)),
            ("destination", sa.Column("destination", sa.String(length=255), nullable=True)),
            ("container_no", sa.Column("container_no", sa.String(length=64), nullable=True)),
            ("dispatch_date", sa.Column("dispatch_date", sa.Date(), nullable=True)),
            ("status", sa.Column("status", sa.String(length=32), nullable=False, server_default="draft")),
            ("gross_weight_kg", sa.Column("gross_weight_kg", sa.Numeric(14, 2), nullable=True)),
            ("net_weight_kg", sa.Column("net_weight_kg", sa.Numeric(14, 2), nullable=True)),
            ("cartons_planned", sa.Column("cartons_planned", sa.Integer(), nullable=False, server_default="0")),
            ("cartons_prepared", sa.Column("cartons_prepared", sa.Integer(), nullable=False, server_default="0")),
            ("remarks", sa.Column("remarks", sa.Text(), nullable=True)),
            ("prepared_by_name", sa.Column("prepared_by_name", sa.String(length=255), nullable=True)),
            ("created_at", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)),
            ("updated_at", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)),
        ]
        for col_name, col_def in columns_to_ensure:
            if col_name not in existing_cols:
                try:
                    op.add_column("export_packing_lists", col_def)
                except Exception:
                    pass

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    existing_indexes_lists = {ix["name"] for ix in inspector.get_indexes("export_packing_lists")} if "export_packing_lists" in tables else set()
    if "ix_export_packing_lists_tenant_id" not in existing_indexes_lists and "export_packing_lists" in tables:
        try:
            op.create_index("ix_export_packing_lists_tenant_id", "export_packing_lists", ["tenant_id"])
        except Exception:
            pass
    if "ix_export_packing_lists_shipment_no" not in existing_indexes_lists and "export_packing_lists" in tables:
        try:
            op.create_index("ix_export_packing_lists_shipment_no", "export_packing_lists", ["shipment_no"])
        except Exception:
            pass

    if "export_packing_list_cartons" not in tables:
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
    else:
        existing_cols = {c["name"] for c in inspector.get_columns("export_packing_list_cartons")}
        carton_columns_to_ensure = [
            ("tenant_id", sa.Column("tenant_id", sa.Integer(), nullable=False)),
            ("packing_list_id", sa.Column("packing_list_id", sa.Integer(), nullable=False)),
            ("carton_no", sa.Column("carton_no", sa.String(length=32), nullable=False)),
            ("sku_code", sa.Column("sku_code", sa.String(length=64), nullable=True)),
            ("item_description", sa.Column("item_description", sa.String(length=512), nullable=False)),
            ("qty_pcs", sa.Column("qty_pcs", sa.Integer(), nullable=False, server_default="0")),
            ("net_weight_kg", sa.Column("net_weight_kg", sa.Numeric(12, 2), nullable=True)),
            ("gross_weight_kg", sa.Column("gross_weight_kg", sa.Numeric(12, 2), nullable=True)),
            ("dim_length_cm", sa.Column("dim_length_cm", sa.Numeric(8, 2), nullable=True)),
            ("dim_width_cm", sa.Column("dim_width_cm", sa.Numeric(8, 2), nullable=True)),
            ("dim_height_cm", sa.Column("dim_height_cm", sa.Numeric(8, 2), nullable=True)),
            ("marks_numbers", sa.Column("marks_numbers", sa.String(length=255), nullable=True)),
            ("package_type", sa.Column("package_type", sa.String(length=64), nullable=True)),
            ("created_at", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)),
            ("updated_at", sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False)),
        ]
        for col_name, col_def in carton_columns_to_ensure:
            if col_name not in existing_cols:
                try:
                    op.add_column("export_packing_list_cartons", col_def)
                except Exception:
                    pass

    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    existing_indexes_cartons = {ix["name"] for ix in inspector.get_indexes("export_packing_list_cartons")} if "export_packing_list_cartons" in tables else set()
    if "ix_export_packing_cartons_list_id" not in existing_indexes_cartons and "export_packing_list_cartons" in tables:
        try:
            op.create_index("ix_export_packing_cartons_list_id", "export_packing_list_cartons", ["packing_list_id"])
        except Exception:
            pass
    if "ix_export_packing_cartons_tenant_id" not in existing_indexes_cartons and "export_packing_list_cartons" in tables:
        try:
            op.create_index("ix_export_packing_cartons_tenant_id", "export_packing_list_cartons", ["tenant_id"])
        except Exception:
            pass


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    if "export_packing_list_cartons" in tables:
        op.drop_table("export_packing_list_cartons")
    if "export_packing_lists" in tables:
        op.drop_table("export_packing_lists")
