"""Unique manufacturing issue code per tenant.

Revision ID: g7h8i9j0k1l2
Revises: f6a7b8c9d0e1
"""

from typing import Sequence, Union

from alembic import op

revision: str = "g7h8i9j0k1l2"
down_revision: Union[str, Sequence[str], None] = "f6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    try:
        op.create_unique_constraint(
            "uq_manufacturing_issues_tenant_code",
            "manufacturing_issues",
            ["tenant_id", "issue_code"],
        )
    except Exception:
        pass


def downgrade() -> None:
    op.drop_constraint("uq_manufacturing_issues_tenant_code", "manufacturing_issues", type_="unique")
