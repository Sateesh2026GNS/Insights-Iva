"""Manufacturing toolkit issue and process checklist tables.

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "f6a7b8c9d0e1"
down_revision: Union[str, Sequence[str], None] = "e5f6a7b8c9d0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())

    if "manufacturing_issues" not in tables:
        op.create_table(
            "manufacturing_issues",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("issue_code", sa.String(length=64), nullable=False),
            sa.Column("title", sa.String(length=255), nullable=False),
            sa.Column("department", sa.String(length=128), nullable=True),
            sa.Column("priority", sa.String(length=32), nullable=False),
            sa.Column("owner_name", sa.String(length=255), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("raised_date", sa.Date(), nullable=False),
            sa.Column("target_date", sa.Date(), nullable=True),
            sa.Column("resolution_notes", sa.Text(), nullable=True),
            sa.Column("closed_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    existing_indexes = {ix["name"] for ix in inspector.get_indexes("manufacturing_issues")} if "manufacturing_issues" in tables else set()
    for name, cols in [
        ("ix_manufacturing_issues_tenant_id", ["tenant_id"]),
        ("ix_manufacturing_issues_issue_code", ["issue_code"]),
        ("ix_manufacturing_issues_status", ["status"]),
        ("ix_manufacturing_issues_raised_date", ["raised_date"]),
    ]:
        if name not in existing_indexes:
            try:
                op.create_index(name, "manufacturing_issues", cols)
            except Exception:
                pass

    if "process_checklist_items" not in tables:
        op.create_table(
            "process_checklist_items",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("checklist_code", sa.String(length=64), nullable=False),
            sa.Column("process_stage", sa.String(length=128), nullable=False),
            sa.Column("description", sa.String(length=512), nullable=False),
            sa.Column("owner_name", sa.String(length=255), nullable=True),
            sa.Column("due_date", sa.Date(), nullable=True),
            sa.Column("frequency", sa.String(length=64), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("verification_result", sa.String(length=32), nullable=True),
            sa.Column("approved_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("approved_by_name", sa.String(length=255), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    existing_chk_indexes = {ix["name"] for ix in inspector.get_indexes("process_checklist_items")} if "process_checklist_items" in tables else set()
    for name, cols in [
        ("ix_process_checklist_items_tenant_id", ["tenant_id"]),
        ("ix_process_checklist_items_checklist_code", ["checklist_code"]),
        ("ix_process_checklist_items_due_date", ["due_date"]),
        ("ix_process_checklist_items_status", ["status"]),
    ]:
        if name not in existing_chk_indexes:
            try:
                op.create_index(name, "process_checklist_items", cols)
            except Exception:
                pass


def downgrade() -> None:
    op.drop_table("process_checklist_items")
    op.drop_table("manufacturing_issues")
