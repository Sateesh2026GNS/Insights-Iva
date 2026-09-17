"""Tenant document library with versioning (separate from legacy ``documents`` metadata rows)."""

from __future__ import annotations

import enum

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class DocumentCategory(str, enum.Enum):
    purchase = "purchase"
    production = "production"
    quality = "quality"
    finance = "finance"
    hr = "hr"
    compliance = "compliance"


class DocumentStatus(str, enum.Enum):
    draft = "draft"
    pending_approval = "pending_approval"
    approved = "approved"
    archived = "archived"


class DocumentFileType(str, enum.Enum):
    pdf = "pdf"
    image = "image"
    excel = "excel"
    word = "word"


class ErpDocument(Base, TimestampMixin):
    __tablename__ = "erp_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    name_normalized: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(32), default=DocumentStatus.draft.value, nullable=False)
    current_version_id: Mapped[int | None] = mapped_column(
        ForeignKey("erp_document_versions.id", use_alter=True, name="fk_erp_doc_current_version"),
        nullable=True,
    )
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    versions: Mapped[list["ErpDocumentVersion"]] = relationship(
        "ErpDocumentVersion",
        back_populates="document",
        foreign_keys="ErpDocumentVersion.document_id",
    )


class ErpDocumentVersion(Base, TimestampMixin):
    __tablename__ = "erp_document_versions"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("erp_documents.id"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    file_path: Mapped[str] = mapped_column(Text, nullable=False)
    file_type: Mapped[str] = mapped_column(String(16), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    upload_note: Mapped[str | None] = mapped_column(Text)

    document: Mapped["ErpDocument"] = relationship(
        "ErpDocument",
        back_populates="versions",
        foreign_keys=[document_id],
    )


class ErpDocumentApproval(Base, TimestampMixin):
    __tablename__ = "erp_document_approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("erp_documents.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    acted_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    note: Mapped[str | None] = mapped_column(Text)
