"""Unique process checklist code per tenant.

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
"""

from typing import Sequence, Union

from alembic import op

revision: str = "h8i9j0k1l2m3"
down_revision: Union[str, Sequence[str], None] = "g7h8i9j0k1l2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_unique_constraint(
        "uq_process_checklist_items_tenant_code",
        "process_checklist_items",
        ["tenant_id", "checklist_code"],
    )


def downgrade() -> None:
    op.drop_constraint(
        "uq_process_checklist_items_tenant_code", "process_checklist_items", type_="unique"
    )
