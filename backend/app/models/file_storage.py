"""Centralized file metadata, attachments, and upload sessions."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class StoredFile(Base, TimestampMixin):
    """File metadata — binary content lives in object storage only."""

    __tablename__ = "stored_files"
    __table_args__ = (
        Index("ix_stored_files_tenant_status", "tenant_id", "upload_status"),
        Index("ix_stored_files_tenant_scan", "tenant_id", "scan_status"),
        Index("ix_stored_files_checksum", "tenant_id", "checksum_sha256"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    uploaded_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)

    original_filename: Mapped[str] = mapped_column(String(512), nullable=False)
    storage_provider: Mapped[str] = mapped_column(String(32), nullable=False, default="s3")
    storage_bucket: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(Text, nullable=False)

    mime_type: Mapped[str | None] = mapped_column(String(128))
    detected_mime_type: Mapped[str | None] = mapped_column(String(128))
    file_extension: Mapped[str | None] = mapped_column(String(32))
    file_size: Mapped[int] = mapped_column(BigInteger, default=0)
    checksum_sha256: Mapped[str | None] = mapped_column(String(64))

    upload_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING_UPLOAD")
    scan_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING_SCAN")
    processing_status: Mapped[str] = mapped_column(String(32), nullable=False, default="PENDING")

    scan_message: Mapped[str | None] = mapped_column(Text)
    processing_message: Mapped[str | None] = mapped_column(Text)
    idempotency_key: Mapped[str | None] = mapped_column(String(128))

    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class FileAttachment(Base, TimestampMixin):
    """Links a stored file to a business entity within a tenant."""

    __tablename__ = "file_attachments"
    __table_args__ = (
        Index("ix_file_attachments_entity", "tenant_id", "entity_type", "entity_id"),
        UniqueConstraint(
            "tenant_id",
            "file_id",
            "entity_type",
            "entity_id",
            name="uq_file_attachment_entity",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    file_id: Mapped[int] = mapped_column(ForeignKey("stored_files.id"), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    label: Mapped[str | None] = mapped_column(String(255))
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class FileUploadSession(Base, TimestampMixin):
    """Multipart / resumable upload session."""

    __tablename__ = "file_upload_sessions"
    __table_args__ = (
        Index("ix_file_upload_sessions_tenant_user", "tenant_id", "user_id", "status"),
        UniqueConstraint("idempotency_key", name="uq_file_upload_idempotency"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_uuid: Mapped[str] = mapped_column(String(36), nullable=False, unique=True, index=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    file_id: Mapped[int] = mapped_column(ForeignKey("stored_files.id"), nullable=False)

    storage_upload_id: Mapped[str | None] = mapped_column(String(255))
    total_chunks: Mapped[int] = mapped_column(Integer, default=1)
    completed_chunks: Mapped[int] = mapped_column(Integer, default=0)
    chunk_size_bytes: Mapped[int] = mapped_column(Integer, default=5 * 1024 * 1024)
    total_size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    idempotency_key: Mapped[str | None] = mapped_column(String(128))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FileUploadChunk(Base):
    """Tracks individual multipart chunk completion."""

    __tablename__ = "file_upload_chunks"
    __table_args__ = (
        UniqueConstraint("session_id", "part_number", name="uq_file_upload_chunk_part"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    session_id: Mapped[int] = mapped_column(ForeignKey("file_upload_sessions.id"), nullable=False, index=True)
    part_number: Mapped[int] = mapped_column(Integer, nullable=False)
    etag: Mapped[str | None] = mapped_column(String(128))
    size_bytes: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
