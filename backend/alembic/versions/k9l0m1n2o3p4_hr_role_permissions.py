"""Revision ID: k9l0m1n2o3p4
Revises: k8l9m0n1o2p3
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "k9l0m1n2o3p4"
down_revision: Union[str, Sequence[str], None] = "k8l9m0n1o2p3"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect
    if "hr_role_permissions" in set(inspect(bind).get_table_names()):
        return
    op.create_table(
        "hr_role_permissions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("role_key", sa.String(length=64), nullable=False),
        sa.Column("permissions_json", sa.Text(), nullable=False, server_default="{}"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "role_key", name="uq_hr_role_permission_key"),
    )
    op.create_index("ix_hr_role_permissions_tenant_id", "hr_role_permissions", ["tenant_id"])


def downgrade() -> None:
    op.drop_index("ix_hr_role_permissions_tenant_id", table_name="hr_role_permissions")
    op.drop_table("hr_role_permissions")
