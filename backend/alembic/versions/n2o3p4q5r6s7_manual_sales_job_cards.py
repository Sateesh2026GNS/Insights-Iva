"""Allow manual sales job cards without linked sales order.

Revision ID: n2o3p4q5r6s7
Revises: m1n2o3p4q5r6
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "n2o3p4q5r6s7"
down_revision: Union[str, Sequence[str], None] = "m1n2o3p4q5r6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "sales_job_cards",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=True,
    )
    op.alter_column(
        "sales_job_cards",
        "customer_id",
        existing_type=sa.Integer(),
        nullable=True,
    )


def downgrade() -> None:
    op.alter_column(
        "sales_job_cards",
        "customer_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
    op.alter_column(
        "sales_job_cards",
        "sales_order_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
