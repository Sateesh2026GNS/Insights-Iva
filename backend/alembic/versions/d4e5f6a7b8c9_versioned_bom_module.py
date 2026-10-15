"""Versioned BOM tables and production_orders.bom_version_id.

Revision ID: d4e5f6a7b8c9
Revises: c9d0e1f2a3b5
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c9d0e1f2a3b5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _tables() -> set[str]:
    return set(inspect(op.get_bind()).get_table_names())


def _columns(table: str) -> set[str]:
    return {col["name"] for col in inspect(op.get_bind()).get_columns(table)}


def _indexes(table: str) -> set[str]:
    return {item["name"] for item in inspect(op.get_bind()).get_indexes(table)}


def _fk_names(table: str) -> set[str]:
    return {fk["name"] for fk in inspect(op.get_bind()).get_foreign_keys(table) if fk.get("name")}


def upgrade() -> None:
    tables = _tables()

    if "bom" not in tables:
        op.create_table(
            "bom",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("bom_code", sa.String(length=64), nullable=False),
            sa.Column("product_id", sa.Integer(), nullable=False),
            sa.Column("name", sa.String(length=255), nullable=False),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("is_archived", sa.Boolean(), nullable=False, server_default=sa.false()),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "bom_code", name="uq_bom_tenant_code"),
        )
    bom_indexes = _indexes("bom")
    if "ix_bom_tenant_id" not in bom_indexes:
        op.create_index("ix_bom_tenant_id", "bom", ["tenant_id"])
    if "ix_bom_tenant_product" not in bom_indexes:
        op.create_index("ix_bom_tenant_product", "bom", ["tenant_id", "product_id"])

    if "bom_version" not in _tables():
        op.create_table(
            "bom_version",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("bom_id", sa.Integer(), nullable=False),
            sa.Column("version_number", sa.Integer(), nullable=False),
            sa.Column("status", sa.String(length=16), nullable=False, server_default="draft"),
            sa.Column("base_quantity", sa.Numeric(18, 4), nullable=False),
            sa.Column("base_uom", sa.String(length=32), nullable=False),
            sa.Column("effective_from", sa.Date(), nullable=True),
            sa.Column("effective_to", sa.Date(), nullable=True),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_by", sa.Integer(), nullable=True),
            sa.Column("activated_by", sa.Integer(), nullable=True),
            sa.Column("activated_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["activated_by"], ["users.id"]),
            sa.ForeignKeyConstraint(["bom_id"], ["bom.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("bom_id", "version_number", name="uq_bom_version_number"),
            sa.CheckConstraint("base_quantity > 0", name="ck_bom_version_base_qty"),
        )
    version_indexes = _indexes("bom_version")
    if "ix_bom_version_bom_id" not in version_indexes:
        op.create_index("ix_bom_version_bom_id", "bom_version", ["bom_id"])
    if "ix_bom_version_status" not in version_indexes:
        op.create_index("ix_bom_version_status", "bom_version", ["bom_id", "status"])
    if "ix_bom_version_one_active" not in version_indexes:
        op.create_index(
            "ix_bom_version_one_active",
            "bom_version",
            ["bom_id"],
            unique=True,
            postgresql_where=sa.text("status = 'active'"),
        )

    if "bom_component" not in _tables():
        op.create_table(
            "bom_component",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("bom_version_id", sa.Integer(), nullable=False),
            sa.Column("line_no", sa.Integer(), nullable=False),
            sa.Column("component_item_id", sa.Integer(), nullable=False),
            sa.Column("component_type", sa.String(length=32), nullable=False, server_default="raw_material"),
            sa.Column("quantity", sa.Numeric(18, 4), nullable=False),
            sa.Column("uom", sa.String(length=32), nullable=False),
            sa.Column("scrap_percent", sa.Numeric(8, 4), nullable=False, server_default="0"),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.ForeignKeyConstraint(["bom_version_id"], ["bom_version.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["component_item_id"], ["products.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("bom_version_id", "component_item_id", name="uq_bom_component_item"),
            sa.CheckConstraint("quantity > 0", name="ck_bom_component_qty_positive"),
            sa.CheckConstraint("scrap_percent >= 0 AND scrap_percent < 100", name="ck_bom_component_scrap"),
        )
    if "ix_bom_component_version" not in _indexes("bom_component"):
        op.create_index("ix_bom_component_version", "bom_component", ["bom_version_id"])

    if "production_orders" in _tables() and "bom_version_id" not in _columns("production_orders"):
        op.add_column(
            "production_orders",
            sa.Column("bom_version_id", sa.Integer(), nullable=True),
        )
    if "production_orders" in _tables():
        if "fk_production_orders_bom_version_id" not in _fk_names("production_orders"):
            op.create_foreign_key(
                "fk_production_orders_bom_version_id",
                "production_orders",
                "bom_version",
                ["bom_version_id"],
                ["id"],
                ondelete="SET NULL",
            )
        if "ix_production_orders_bom_version_id" not in _indexes("production_orders"):
            op.create_index("ix_production_orders_bom_version_id", "production_orders", ["bom_version_id"])


def downgrade() -> None:
    tables = _tables()
    if "production_orders" in tables:
        if "ix_production_orders_bom_version_id" in _indexes("production_orders"):
            op.drop_index("ix_production_orders_bom_version_id", table_name="production_orders")
        if "fk_production_orders_bom_version_id" in _fk_names("production_orders"):
            op.drop_constraint("fk_production_orders_bom_version_id", "production_orders", type_="foreignkey")
        if "bom_version_id" in _columns("production_orders"):
            op.drop_column("production_orders", "bom_version_id")
    if "bom_component" in tables:
        if "ix_bom_component_version" in _indexes("bom_component"):
            op.drop_index("ix_bom_component_version", table_name="bom_component")
        op.drop_table("bom_component")
    if "bom_version" in _tables():
        version_indexes = _indexes("bom_version")
        if "ix_bom_version_one_active" in version_indexes:
            op.drop_index("ix_bom_version_one_active", table_name="bom_version")
        if "ix_bom_version_status" in version_indexes:
            op.drop_index("ix_bom_version_status", table_name="bom_version")
        if "ix_bom_version_bom_id" in version_indexes:
            op.drop_index("ix_bom_version_bom_id", table_name="bom_version")
        op.drop_table("bom_version")
    if "bom" in _tables():
        bom_indexes = _indexes("bom")
        if "ix_bom_tenant_product" in bom_indexes:
            op.drop_index("ix_bom_tenant_product", table_name="bom")
        if "ix_bom_tenant_id" in bom_indexes:
            op.drop_index("ix_bom_tenant_id", table_name="bom")
        op.drop_table("bom")
