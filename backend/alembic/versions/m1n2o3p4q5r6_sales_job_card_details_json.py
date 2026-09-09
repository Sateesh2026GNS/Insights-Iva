"""Add details_json to sales_job_cards for production job card sections.

Revision ID: m1n2o3p4q5r6
Revises: l0m1n2o3p4q5
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "m1n2o3p4q5r6"
down_revision: Union[str, Sequence[str], None] = "l0m1n2o3p4q5"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    cols = {c["name"] for c in inspect(bind).get_columns("sales_job_cards")}
    if "details_json" not in cols:
        op.add_column("sales_job_cards", sa.Column("details_json", sa.Text(), nullable=True))


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    cols = {c["name"] for c in inspect(bind).get_columns("sales_job_cards")}
    if "details_json" in cols:
        op.drop_column("sales_job_cards", "details_json")
