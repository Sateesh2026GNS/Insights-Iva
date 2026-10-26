"""Add CRM reminders for the Buyer & Client CRM Tracker.

Revision ID: a8b9c0d1e2f3
Revises: z7a8b9c0d1e2
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a8b9c0d1e2f3"
down_revision: Union[str, Sequence[str], None] = "z7a8b9c0d1e2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    if "crm_reminders" in sa.inspect(bind).get_table_names():
        return
    op.create_table(
        "crm_reminders",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("customer_id", sa.Integer(), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("due_on", sa.Date(), nullable=True),
        sa.Column("completed", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.ForeignKeyConstraint(["customer_id"], ["customers.id"]),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_crm_reminders_tenant_id", "crm_reminders", ["tenant_id"])
    op.create_index("ix_crm_reminders_customer_id", "crm_reminders", ["customer_id"])


def downgrade() -> None:
    bind = op.get_bind()
    if "crm_reminders" not in sa.inspect(bind).get_table_names():
        return
    op.drop_index("ix_crm_reminders_customer_id", table_name="crm_reminders")
    op.drop_index("ix_crm_reminders_tenant_id", table_name="crm_reminders")
    op.drop_table("crm_reminders")
