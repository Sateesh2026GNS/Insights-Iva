"""Vendor-specific purchase and selling prices for Product master records."""

from sqlalchemy import Boolean, ForeignKey, Index, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ProductVendorPricing(Base, TimestampMixin):
    __tablename__ = "product_vendor_pricing"
    __table_args__ = (
        UniqueConstraint(
            "tenant_id",
            "product_id",
            "supplier_id",
            name="uq_product_vendor_pricing_tenant_product_vendor",
        ),
        Index("ix_product_vendor_pricing_tenant_active", "tenant_id", "is_active"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False, index=True
    )
    supplier_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False, index=True
    )

    purchase_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    transport_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    labour_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    import_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    total_landed_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    minimum_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    maximum_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)
    selling_price: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False, default=0)

    currency: Mapped[str] = mapped_column(String(16), default="INR", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    created_by: Mapped[str | None] = mapped_column(String(255))
    updated_by: Mapped[str | None] = mapped_column(String(255))

    product = relationship("Product", foreign_keys=[product_id])
    supplier = relationship("Supplier", foreign_keys=[supplier_id])
