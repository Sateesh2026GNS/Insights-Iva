"""Lead extended fields and attachments.

Revision ID: a9b8c7d6e5f4
Revises: z4a5b6c7d8e9
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "a9b8c7d6e5f4"
down_revision: Union[str, None] = "z4a5b6c7d8e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, column: str) -> bool:
    return column in {c["name"] for c in inspector.get_columns(table)}


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    inspector = inspect(bind)
    tables = set(inspector.get_table_names())
    if "leads" not in tables:
        return

    cols = [
        ("lead_no", sa.String(32)),
        ("company_name", sa.String(255)),
        ("contact_person", sa.String(255)),
        ("city", sa.String(128)),
        ("state", sa.String(128)),
        ("gst_number", sa.String(32)),
        ("product_id", sa.Integer()),
        ("quantity", sa.Numeric(14, 3)),
        ("expected_value", sa.Numeric(14, 2)),
        ("expected_close_date", sa.Date()),
        ("requirement_details", sa.Text()),
        ("assigned_user_id", sa.Integer()),
        ("is_draft", sa.Boolean()),
        ("created_by", sa.Integer()),
    ]
    for name, col_type in cols:
        if not _has_column(inspector, "leads", name):
            kwargs = {"nullable": True}
            if name == "is_draft":
                kwargs = {"nullable": False, "server_default": sa.text("false")}
            op.add_column("leads", sa.Column(name, col_type, **kwargs))

    if "lead_attachments" not in tables:
        op.create_table(
            "lead_attachments",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("tenant_id", sa.Integer(), nullable=False),
            sa.Column("lead_id", sa.Integer(), nullable=False),
            sa.Column("file_name", sa.String(255), nullable=False),
            sa.Column("file_path", sa.String(512), nullable=False),
            sa.Column("size", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("uploaded_by", sa.Integer(), nullable=True),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.text("now()"),
                nullable=False,
            ),
            sa.ForeignKeyConstraint(["lead_id"], ["leads.id"], ondelete="CASCADE"),
            sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
            sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_lead_attachments_lead_id", "lead_attachments", ["lead_id"])
        op.create_index("ix_lead_attachments_tenant_id", "lead_attachments", ["tenant_id"])


def downgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    inspector = inspect(bind)
    if "lead_attachments" in set(inspector.get_table_names()):
        op.drop_table("lead_attachments")
    for name in (
        "created_by",
        "is_draft",
        "assigned_user_id",
        "requirement_details",
        "expected_close_date",
        "expected_value",
        "quantity",
        "product_id",
        "gst_number",
        "state",
        "city",
        "contact_person",
        "company_name",
        "lead_no",
    ):
        if _has_column(inspector, "leads", name):
            op.drop_column("leads", name)
