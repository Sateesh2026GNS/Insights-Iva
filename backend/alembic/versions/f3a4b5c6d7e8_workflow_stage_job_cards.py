"""Add workflow stage job cards and material issue lines.

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-08-21 12:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    tables = set(inspect(bind).get_table_names())

    if "workflow_stage_job_cards" not in tables:
        op.create_table(
            "workflow_stage_job_cards",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("sales_order_id", sa.Integer(), nullable=False),
            sa.Column("sales_job_card_id", sa.Integer(), nullable=True),
            sa.Column("stage", sa.String(length=32), nullable=False),
            sa.Column("card_number", sa.String(length=64), nullable=False),
            sa.Column("status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("material_check_id", sa.Integer(), nullable=True),
            sa.Column("work_order_id", sa.Integer(), nullable=True),
            sa.Column("quality_inspection_id", sa.Integer(), nullable=True),
            sa.Column("dispatch_id", sa.Integer(), nullable=True),
            sa.Column("invoice_id", sa.Integer(), nullable=True),
            sa.Column("assigned_user_id", sa.Integer(), nullable=True),
            sa.Column("payload_json", sa.Text(), nullable=True),
            sa.Column("completed_by_user_id", sa.Integer(), nullable=True),
            sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["assigned_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["completed_by_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["dispatch_id"], ["dispatch_shipments.id"]),
            sa.ForeignKeyConstraint(["invoice_id"], ["invoices.id"]),
            sa.ForeignKeyConstraint(["material_check_id"], ["sales_order_material_checks.id"]),
            sa.ForeignKeyConstraint(["quality_inspection_id"], ["quality_inspections.id"]),
            sa.ForeignKeyConstraint(["sales_job_card_id"], ["sales_job_cards.id"]),
            sa.ForeignKeyConstraint(["sales_order_id"], ["sales_orders.id"]),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["work_order_id"], ["work_orders.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("tenant_id", "card_number", name="uq_workflow_stage_cards_tenant_no"),
            sa.UniqueConstraint(
                "tenant_id", "sales_order_id", "stage", name="uq_workflow_stage_cards_tenant_so_stage"
            ),
        )
        op.create_index("ix_workflow_stage_job_cards_tenant_id", "workflow_stage_job_cards", ["tenant_id"])
        op.create_index("ix_workflow_stage_job_cards_sales_order_id", "workflow_stage_job_cards", ["sales_order_id"])
        op.create_index("ix_workflow_stage_job_cards_stage", "workflow_stage_job_cards", ["stage"])
        op.create_index("ix_workflow_stage_job_cards_card_number", "workflow_stage_job_cards", ["card_number"])

    if "workflow_material_issue_lines" not in tables:
        op.create_table(
            "workflow_material_issue_lines",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("stage_job_card_id", sa.Integer(), nullable=False),
            sa.Column("material_check_line_id", sa.Integer(), nullable=True),
            sa.Column("product_id", sa.Integer(), nullable=True),
            sa.Column("material_code", sa.String(length=64), nullable=True),
            sa.Column("material_name", sa.String(length=255), nullable=False),
            sa.Column("required_qty", sa.Numeric(precision=12, scale=2), nullable=False),
            sa.Column("available_qty", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
            sa.Column("issued_qty", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
            sa.Column("remaining_qty", sa.Numeric(precision=12, scale=2), nullable=False, server_default="0"),
            sa.Column("store_location", sa.String(length=255), nullable=True),
            sa.Column("issue_status", sa.String(length=32), nullable=False, server_default="pending"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["material_check_line_id"], ["sales_order_material_check_lines.id"]),
            sa.ForeignKeyConstraint(["product_id"], ["products.id"]),
            sa.ForeignKeyConstraint(["stage_job_card_id"], ["workflow_stage_job_cards.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index(
            "ix_workflow_material_issue_lines_stage_job_card_id",
            "workflow_material_issue_lines",
            ["stage_job_card_id"],
        )


def downgrade() -> None:
    op.drop_index("ix_workflow_material_issue_lines_stage_job_card_id", table_name="workflow_material_issue_lines")
    op.drop_table("workflow_material_issue_lines")
    op.drop_index("ix_workflow_stage_job_cards_card_number", table_name="workflow_stage_job_cards")
    op.drop_index("ix_workflow_stage_job_cards_stage", table_name="workflow_stage_job_cards")
    op.drop_index("ix_workflow_stage_job_cards_sales_order_id", table_name="workflow_stage_job_cards")
    op.drop_index("ix_workflow_stage_job_cards_tenant_id", table_name="workflow_stage_job_cards")
    op.drop_table("workflow_stage_job_cards")
