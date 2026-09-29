from sqlalchemy import ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Product(Base, TimestampMixin):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    sku: Mapped[str | None] = mapped_column(String(64), nullable=True, default="")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str | None] = mapped_column(String(128), default="Finished Goods")
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    unit_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    wholesale_price: Mapped[float | None] = mapped_column(Numeric(12, 2))
    min_stock: Mapped[int | None] = mapped_column(Integer, default=0)
    max_stock: Mapped[int | None] = mapped_column(Integer, default=100)
    current_stock: Mapped[float] = mapped_column(Numeric(14, 3), default=0, nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32), default="Pcs")
    hsn_code: Mapped[str | None] = mapped_column(String(32))
    gst_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)
    cess_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), default=0)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)

    tenant = relationship("Tenant", back_populates="products")
    bom_items = relationship(
        "BillOfMaterial",
        foreign_keys="BillOfMaterial.product_id",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    component_of = relationship(
        "BillOfMaterial",
        foreign_keys="BillOfMaterial.component_product_id",
        back_populates="component",
    )
    production_orders = relationship(
        "ProductionOrder", back_populates="product", cascade="all, delete-orphan"
    )
    stock_events = relationship(
        "ProductStockEvent",
        back_populates="product",
        cascade="all, delete-orphan",
    )


class InventoryCategory(Base, TimestampMixin):
    """Tenant-scoped product categories for Inventory V2."""

    __tablename__ = "inventory_categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)


class ProductStockEvent(Base, TimestampMixin):
    """Stock timeline entries for Inventory V2 (add / remove / opening)."""

    __tablename__ = "product_stock_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False, index=True
    )
    activity: Mapped[str] = mapped_column(String(64), nullable=False)
    subtitle: Mapped[str | None] = mapped_column(String(255))
    change_qty: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=0)
    final_qty: Mapped[float] = mapped_column(Numeric(14, 3), nullable=False, default=0)
    unit: Mapped[str | None] = mapped_column(String(32))
    remark: Mapped[str | None] = mapped_column(Text)
    event_date: Mapped[str | None] = mapped_column(String(32))

    product = relationship("Product", back_populates="stock_events")
