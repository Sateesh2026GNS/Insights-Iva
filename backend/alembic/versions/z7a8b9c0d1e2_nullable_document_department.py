"""Allow document uploads without a department assignment.

Revision ID: z7a8b9c0d1e2
Revises: z6a7b8c9d0e1
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "z7a8b9c0d1e2"
down_revision: Union[str, Sequence[str], None] = "z6a7b8c9d0e1"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    if "erp_documents" not in sa.inspect(op.get_bind()).get_table_names():
        return
    with op.batch_alter_table("erp_documents") as batch_op:
        batch_op.alter_column(
            "department_id",
            existing_type=sa.Integer(),
            existing_nullable=False,
            nullable=True,
        )


def downgrade() -> None:
    if "erp_documents" not in sa.inspect(op.get_bind()).get_table_names():
        return
    with op.batch_alter_table("erp_documents") as batch_op:
        batch_op.alter_column(
            "department_id",
            existing_type=sa.Integer(),
            existing_nullable=True,
            nullable=False,
        )
