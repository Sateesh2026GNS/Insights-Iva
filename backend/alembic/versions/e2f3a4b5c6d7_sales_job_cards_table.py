"""Add sales_job_cards table for persisted sales order job cards.

Revision ID: e2f3a4b5c6d7
Revises: d1e2f3a4b5c6
Create Date: 2026-08-18 00:30:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "e2f3a4b5c6d7"
down_revision: Union[str, Sequence[str], None] = "d1e2f3a4b5c6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    tables = set(inspect(bind).get_table_names())
    if "sales_job_cards" in tables:
        return

    op.create_table(
        "sales_job_cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("job_card_no", sa.String(length=64), nullable=False),
        sa.Column("sales_order_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=False),
        sa.Column("product_id", sa.Integer(), nullable=True),
        sa.Column("quantity", sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column("unit", sa.String(length=32), nullable=False, server_default="Nos"),
        sa.Column("required_delivery_date", sa.Date(), nullable=True),
        sa.Column("priority", sa.String(length=16), nullable=False, server_default="medium"),
        sa.Column("sales_person_id", sa.Integer(), nullable=True),
        sa.Column("sales_person_name", sa.String(length=255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("workflow_stage", sa.String(length=64), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
        sa.ForeignKeyConstraint(["sales_order_id"], ["sales_orders.id"]),
        sa.ForeignKeyConstraint(["sales_person_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "job_card_no", name="uq_sales_job_cards_tenant_no"),
        sa.UniqueConstraint("tenant_id", "sales_order_id", name="uq_sales_job_cards_tenant_so"),
    )
    op.create_index("ix_sales_job_cards_job_card_no", "sales_job_cards", ["job_card_no"], unique=False)
    op.create_index("ix_sales_job_cards_sales_order_id", "sales_job_cards", ["sales_order_id"], unique=False)
    op.create_index("ix_sales_job_cards_tenant_id", "sales_job_cards", ["tenant_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_sales_job_cards_tenant_id", table_name="sales_job_cards")
    op.drop_index("ix_sales_job_cards_sales_order_id", table_name="sales_job_cards")
    op.drop_index("ix_sales_job_cards_job_card_no", table_name="sales_job_cards")
    op.drop_table("sales_job_cards")
