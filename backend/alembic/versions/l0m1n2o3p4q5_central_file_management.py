"""Central file management tables — stored_files, attachments, upload sessions.

Revision ID: l0m1n2o3p4q5
Revises: k9l0m1n2o3p4
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "l0m1n2o3p4q5"
down_revision: Union[str, Sequence[str], None] = "k9l0m1n2o3p4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    from sqlalchemy import inspect

    existing = set(inspect(bind).get_table_names())
    if "stored_files" in existing:
        return

    op.create_table(
        "stored_files",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("uploaded_by_user_id", sa.Integer(), nullable=True),
        sa.Column("original_filename", sa.String(length=512), nullable=False),
        sa.Column("storage_provider", sa.String(length=32), nullable=False, server_default="s3"),
        sa.Column("storage_bucket", sa.String(length=255), nullable=False),
        sa.Column("storage_key", sa.Text(), nullable=False),
        sa.Column("mime_type", sa.String(length=128), nullable=True),
        sa.Column("detected_mime_type", sa.String(length=128), nullable=True),
        sa.Column("file_extension", sa.String(length=32), nullable=True),
        sa.Column("file_size", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("checksum_sha256", sa.String(length=64), nullable=True),
        sa.Column("upload_status", sa.String(length=32), nullable=False, server_default="PENDING_UPLOAD"),
        sa.Column("scan_status", sa.String(length=32), nullable=False, server_default="PENDING_SCAN"),
        sa.Column("processing_status", sa.String(length=32), nullable=False, server_default="PENDING"),
        sa.Column("scan_message", sa.Text(), nullable=True),
        sa.Column("processing_message", sa.Text(), nullable=True),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["uploaded_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_stored_files_tenant_id", "stored_files", ["tenant_id"])
    op.create_index("ix_stored_files_tenant_status", "stored_files", ["tenant_id", "upload_status"])
    op.create_index("ix_stored_files_tenant_scan", "stored_files", ["tenant_id", "scan_status"])
    op.create_index("ix_stored_files_checksum", "stored_files", ["tenant_id", "checksum_sha256"])

    op.create_table(
        "file_attachments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("entity_type", sa.String(length=64), nullable=False),
        sa.Column("entity_id", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(length=255), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["stored_files.id"]),
        sa.ForeignKeyConstraint(["created_by_user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("tenant_id", "file_id", "entity_type", "entity_id", name="uq_file_attachment_entity"),
    )
    op.create_index("ix_file_attachments_tenant_id", "file_attachments", ["tenant_id"])
    op.create_index("ix_file_attachments_file_id", "file_attachments", ["file_id"])
    op.create_index("ix_file_attachments_entity", "file_attachments", ["tenant_id", "entity_type", "entity_id"])

    op.create_table(
        "file_upload_sessions",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_uuid", sa.String(length=36), nullable=False),
        sa.Column("tenant_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("file_id", sa.Integer(), nullable=False),
        sa.Column("storage_upload_id", sa.String(length=255), nullable=True),
        sa.Column("total_chunks", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("completed_chunks", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("chunk_size_bytes", sa.Integer(), nullable=False, server_default=str(5 * 1024 * 1024)),
        sa.Column("total_size_bytes", sa.BigInteger(), nullable=False, server_default="0"),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="ACTIVE"),
        sa.Column("idempotency_key", sa.String(length=128), nullable=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["tenant_id"], ["tenants.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["file_id"], ["stored_files.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_uuid"),
        sa.UniqueConstraint("idempotency_key"),
    )
    op.create_index("ix_file_upload_sessions_session_uuid", "file_upload_sessions", ["session_uuid"])
    op.create_index("ix_file_upload_sessions_tenant_id", "file_upload_sessions", ["tenant_id"])
    op.create_index("ix_file_upload_sessions_tenant_user", "file_upload_sessions", ["tenant_id", "user_id", "status"])

    op.create_table(
        "file_upload_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("part_number", sa.Integer(), nullable=False),
        sa.Column("etag", sa.String(length=128), nullable=True),
        sa.Column("size_bytes", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["session_id"], ["file_upload_sessions.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "part_number", name="uq_file_upload_chunk_part"),
    )
    op.create_index("ix_file_upload_chunks_session_id", "file_upload_chunks", ["session_id"])


def downgrade() -> None:
    op.drop_index("ix_file_upload_chunks_session_id", table_name="file_upload_chunks")
    op.drop_table("file_upload_chunks")
    op.drop_index("ix_file_upload_sessions_tenant_user", table_name="file_upload_sessions")
    op.drop_index("ix_file_upload_sessions_tenant_id", table_name="file_upload_sessions")
    op.drop_index("ix_file_upload_sessions_session_uuid", table_name="file_upload_sessions")
    op.drop_table("file_upload_sessions")
    op.drop_index("ix_file_attachments_entity", table_name="file_attachments")
    op.drop_index("ix_file_attachments_file_id", table_name="file_attachments")
    op.drop_index("ix_file_attachments_tenant_id", table_name="file_attachments")
    op.drop_table("file_attachments")
    op.drop_index("ix_stored_files_checksum", table_name="stored_files")
    op.drop_index("ix_stored_files_tenant_scan", table_name="stored_files")
    op.drop_index("ix_stored_files_tenant_status", table_name="stored_files")
    op.drop_index("ix_stored_files_tenant_id", table_name="stored_files")
    op.drop_table("stored_files")
