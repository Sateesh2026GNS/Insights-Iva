"""Versioned Bill of Materials (manufacturing BOM module)."""

from __future__ import annotations

from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class BomHeader(Base, TimestampMixin):
    """One BOM per finished product (tenant-scoped)."""

    __tablename__ = "bom"
    __table_args__ = (
        UniqueConstraint("tenant_id", "bom_code", name="uq_bom_tenant_code"),
        Index("ix_bom_tenant_product", "tenant_id", "product_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    bom_code: Mapped[str] = mapped_column(String(64), nullable=False)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_archived: Mapped[bool] = mapped_column(default=False, nullable=False)

    product = relationship("Product", foreign_keys=[product_id])
    versions = relationship(
        "BomVersion",
        back_populates="bom",
        cascade="all, delete-orphan",
        order_by="BomVersion.version_number",
    )


class BomVersion(Base, TimestampMixin):
    __tablename__ = "bom_version"
    __table_args__ = (
        UniqueConstraint("bom_id", "version_number", name="uq_bom_version_number"),
        Index("ix_bom_version_status", "bom_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("bom.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="draft")
    base_quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    base_uom: Mapped[str] = mapped_column(String(32), nullable=False)
    effective_from: Mapped[date | None] = mapped_column(Date, nullable=True)
    effective_to: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    activated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    bom = relationship("BomHeader", back_populates="versions")
    components = relationship(
        "BomComponent",
        back_populates="version",
        cascade="all, delete-orphan",
        order_by="BomComponent.line_no",
    )


class BomComponent(Base):
    __tablename__ = "bom_component"
    __table_args__ = (
        UniqueConstraint("bom_version_id", "component_item_id", name="uq_bom_component_item"),
        Index("ix_bom_component_version", "bom_version_id"),
        CheckConstraint("quantity > 0", name="ck_bom_component_qty_positive"),
        CheckConstraint("scrap_percent >= 0 AND scrap_percent < 100", name="ck_bom_component_scrap"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    bom_version_id: Mapped[int] = mapped_column(
        ForeignKey("bom_version.id", ondelete="CASCADE"), nullable=False
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    component_item_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False)
    component_type: Mapped[str] = mapped_column(String(32), nullable=False, default="raw_material")
    quantity: Mapped[float] = mapped_column(Numeric(18, 4), nullable=False)
    uom: Mapped[str] = mapped_column(String(32), nullable=False)
    scrap_percent: Mapped[float] = mapped_column(Numeric(8, 4), nullable=False, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    version = relationship("BomVersion", back_populates="components")
    component_product = relationship("Product", foreign_keys=[component_item_id])
