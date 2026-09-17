"""ERP document library with versioning.

Revision ID: t8u9v0w1x2y3
Revises: s7t8u9v0w1x2
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "t8u9v0w1x2y3"
down_revision: Union[str, Sequence[str], None] = "s7t8u9v0w1x2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "erp_documents",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("name_normalized", sa.String(length=255), nullable=False),
        sa.Column("category", sa.String(length=32), nullable=False),
        sa.Column("department_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("current_version_id", sa.Integer(), nullable=True),
        sa.Column("created_by", sa.Integer(), nullable=False),
        sa.Column("is_deleted", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["department_id"], ["departments.id"]),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_erp_documents_tenant_id", "erp_documents", ["tenant_id"])
    op.create_index("ix_erp_documents_name_normalized", "erp_documents", ["name_normalized"])
    op.create_index("ix_erp_documents_category", "erp_documents", ["category"])
    op.create_index("ix_erp_documents_department_id", "erp_documents", ["department_id"])

    op.create_table(
        "erp_document_versions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("version_number", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.Text(), nullable=False),
        sa.Column("file_type", sa.String(length=16), nullable=False),
        sa.Column("file_size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("uploaded_by", sa.Integer(), nullable=False),
        sa.Column("upload_note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["erp_documents.id"]),
        sa.ForeignKeyConstraint(["uploaded_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_erp_document_versions_document_id", "erp_document_versions", ["document_id"])

    op.create_table(
        "erp_document_approvals",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("document_id", sa.Integer(), nullable=False),
        sa.Column("action", sa.String(length=32), nullable=False),
        sa.Column("acted_by", sa.Integer(), nullable=False),
        sa.Column("note", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["document_id"], ["erp_documents.id"]),
        sa.ForeignKeyConstraint(["acted_by"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_erp_document_approvals_document_id", "erp_document_approvals", ["document_id"])

    op.create_foreign_key(
        "fk_erp_doc_current_version",
        "erp_documents",
        "erp_document_versions",
        ["current_version_id"],
        ["id"],
        use_alter=True,
    )


def downgrade() -> None:
    op.drop_constraint("fk_erp_doc_current_version", "erp_documents", type_="foreignkey")
    op.drop_index("ix_erp_document_approvals_document_id", table_name="erp_document_approvals")
    op.drop_table("erp_document_approvals")
    op.drop_index("ix_erp_document_versions_document_id", table_name="erp_document_versions")
    op.drop_table("erp_document_versions")
    op.drop_index("ix_erp_documents_department_id", table_name="erp_documents")
    op.drop_index("ix_erp_documents_category", table_name="erp_documents")
    op.drop_index("ix_erp_documents_name_normalized", table_name="erp_documents")
    op.drop_index("ix_erp_documents_tenant_id", table_name="erp_documents")
    op.drop_table("erp_documents")
