"""Production entry idempotency, source, and void columns.

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5a6

Schema only. This revision does not copy quantities or change actual_quantity.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c2d3e4f5a6b7"
down_revision: Union[str, Sequence[str], None] = "b1c2d3e4f5a6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "production_entries" not in insp.get_table_names():
        return
    cols = {c["name"] for c in insp.get_columns("production_entries")}
    if "idempotency_key" not in cols:
        op.add_column("production_entries", sa.Column("idempotency_key", sa.String(length=128), nullable=True))
    if "source" not in cols:
        op.add_column(
            "production_entries",
            sa.Column("source", sa.String(length=32), nullable=False, server_default=sa.text("'operator'")),
        )
    else:
        op.execute("UPDATE production_entries SET source = 'operator' WHERE source IS NULL")
        op.alter_column(
            "production_entries",
            "source",
            existing_type=sa.String(length=32),
            nullable=False,
            server_default=sa.text("'operator'"),
        )
    if "voided_at" not in cols:
        op.add_column("production_entries", sa.Column("voided_at", sa.DateTime(timezone=True), nullable=True))
    if "voided_by" not in cols:
        op.add_column("production_entries", sa.Column("voided_by", sa.Integer(), nullable=True))
    insp = sa.inspect(bind)
    fk_names = {fk["name"] for fk in insp.get_foreign_keys("production_entries")}
    if "fk_production_entries_voided_by_users" not in fk_names:
        op.create_foreign_key(
            "fk_production_entries_voided_by_users",
            "production_entries",
            "users",
            ["voided_by"],
            ["id"],
            ondelete="SET NULL",
        )
    indexes = {idx["name"] for idx in insp.get_indexes("production_entries")}
    if "ix_production_entries_operator_recorded" not in indexes:
        op.create_index(
            "ix_production_entries_operator_recorded",
            "production_entries",
            ["operator_user_id", "recorded_at"],
        )
    if "ix_production_entries_work_order_voided" not in indexes:
        op.create_index(
            "ix_production_entries_work_order_voided",
            "production_entries",
            ["work_order_id", "voided_at"],
        )
    if "uq_production_entries_operator_idempotency" not in indexes:
        op.create_index(
            "uq_production_entries_operator_idempotency",
            "production_entries",
            ["operator_user_id", "idempotency_key"],
            unique=True,
            postgresql_where=sa.text("idempotency_key IS NOT NULL"),
            sqlite_where=sa.text("idempotency_key IS NOT NULL"),
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "production_entries" not in insp.get_table_names():
        return
    indexes = {idx["name"] for idx in insp.get_indexes("production_entries")}
    if "uq_production_entries_operator_idempotency" in indexes:
        op.drop_index("uq_production_entries_operator_idempotency", table_name="production_entries")
    if "ix_production_entries_work_order_voided" in indexes:
        op.drop_index("ix_production_entries_work_order_voided", table_name="production_entries")
    if "ix_production_entries_operator_recorded" in indexes:
        op.drop_index("ix_production_entries_operator_recorded", table_name="production_entries")
    cols = {c["name"] for c in insp.get_columns("production_entries")}
    if "voided_by" in cols:
        fk_names = {fk["name"] for fk in insp.get_foreign_keys("production_entries")}
        if "fk_production_entries_voided_by_users" in fk_names:
            op.drop_constraint(
                "fk_production_entries_voided_by_users",
                "production_entries",
                type_="foreignkey",
            )
        op.drop_column("production_entries", "voided_by")
    if "voided_at" in cols:
        op.drop_column("production_entries", "voided_at")
    if "source" in cols:
        op.drop_column("production_entries", "source")
    if "idempotency_key" in cols:
        op.drop_column("production_entries", "idempotency_key")
