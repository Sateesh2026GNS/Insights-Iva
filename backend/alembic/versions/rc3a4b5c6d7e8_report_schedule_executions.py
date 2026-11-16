"""Report schedule timezone/next_run fields and execution history.

Revision ID: rc3a4b5c6d7e8
Revises: a9c0d1e2f3b4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "rc3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "a9c0d1e2f3b4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(insp, table: str, column: str) -> bool:
    if table not in insp.get_table_names():
        return False
    return column in {c["name"] for c in insp.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if "report_schedules" in insp.get_table_names():
        if not _has_column(insp, "report_schedules", "custom_report_id"):
            op.add_column("report_schedules", sa.Column("custom_report_id", sa.Integer(), nullable=True))
            op.create_foreign_key(
                "fk_report_schedules_custom_report_id",
                "report_schedules",
                "custom_reports",
                ["custom_report_id"],
                ["id"],
            )
            op.create_index("ix_report_schedules_custom_report_id", "report_schedules", ["custom_report_id"])
        if not _has_column(insp, "report_schedules", "timezone"):
            op.add_column(
                "report_schedules",
                sa.Column("timezone", sa.String(length=64), nullable=False, server_default="Asia/Kolkata"),
            )
        if not _has_column(insp, "report_schedules", "start_date"):
            op.add_column("report_schedules", sa.Column("start_date", sa.DateTime(timezone=True), nullable=True))
        if not _has_column(insp, "report_schedules", "end_date"):
            op.add_column("report_schedules", sa.Column("end_date", sa.DateTime(timezone=True), nullable=True))
        if not _has_column(insp, "report_schedules", "next_run_at"):
            op.add_column("report_schedules", sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True))
            op.create_index("ix_report_schedules_next_run_at", "report_schedules", ["next_run_at"])
        if not _has_column(insp, "report_schedules", "last_status"):
            op.add_column("report_schedules", sa.Column("last_status", sa.String(length=32), nullable=True))
        if not _has_column(insp, "report_schedules", "last_error"):
            op.add_column("report_schedules", sa.Column("last_error", sa.Text(), nullable=True))
        if not _has_column(insp, "report_schedules", "retry_count"):
            op.add_column(
                "report_schedules",
                sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
            )

    if "report_schedule_executions" not in insp.get_table_names():
        op.create_table(
            "report_schedule_executions",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("schedule_id", sa.Integer(), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(length=32), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=True),
            sa.Column("export_token", sa.String(length=128), nullable=True),
            sa.Column("storage_key", sa.String(length=512), nullable=True),
            sa.Column("row_count", sa.Integer(), nullable=True),
            sa.Column("triggered_by", sa.String(length=32), nullable=False, server_default="scheduler"),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["schedule_id"], ["report_schedules.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_report_schedule_executions_tenant_id", "report_schedule_executions", ["tenant_id"])
        op.create_index("ix_report_schedule_executions_schedule_id", "report_schedule_executions", ["schedule_id"])


def downgrade() -> None:
    op.drop_table("report_schedule_executions")
