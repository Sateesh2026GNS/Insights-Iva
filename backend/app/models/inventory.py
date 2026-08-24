from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Warehouse(Base, TimestampMixin):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    capacity: Mapped[int | None] = mapped_column(Integer)
    used_capacity: Mapped[int | None] = mapped_column(Integer, default=0)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    warehouse_type: Mapped[str | None] = mapped_column(String(64))
    branch: Mapped[str | None] = mapped_column(String(128))
    plant: Mapped[str | None] = mapped_column(String(128))
    address: Mapped[str | None] = mapped_column(String(512))
    city: Mapped[str | None] = mapped_column(String(128))
    state: Mapped[str | None] = mapped_column(String(128))
    pincode: Mapped[str | None] = mapped_column(String(16))
    manager_name: Mapped[str | None] = mapped_column(String(255))
    manager_phone: Mapped[str | None] = mapped_column(String(64))
    rack_count: Mapped[int | None] = mapped_column(Integer)
    bin_count: Mapped[int | None] = mapped_column(Integer)

    stock_levels = relationship(
        "StockLevel", back_populates="warehouse", cascade="all, delete-orphan"
    )


class Supplier(Base, TimestampMixin):
    """Vendor master (table name kept as suppliers for backward compatibility)."""

    __tablename__ = "suppliers"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    vendor_code: Mapped[str | None] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    alternate_contact: Mapped[str | None] = mapped_column(String(255))
    alternate_phone: Mapped[str | None] = mapped_column(String(64))
    alternate_email: Mapped[str | None] = mapped_column(String(255))
    website: Mapped[str | None] = mapped_column(String(255))
    approval_status: Mapped[str] = mapped_column(
        String(32), default="approved", nullable=False
    )  # pending, approved, rejected
    status: Mapped[str] = mapped_column(
        String(32), default="active", nullable=False
    )  # active, inactive, blacklisted
    vendor_type: Mapped[str | None] = mapped_column(String(64))
    category: Mapped[str | None] = mapped_column(String(128))
    material_type: Mapped[str | None] = mapped_column(String(128))
    gstin: Mapped[str | None] = mapped_column(String(64))
    pan: Mapped[str | None] = mapped_column(String(32))
    msme: Mapped[str | None] = mapped_column(String(64))
    business_type: Mapped[str | None] = mapped_column(String(64))
    gst_registration_type: Mapped[str | None] = mapped_column(String(64))
    billing_address: Mapped[str | None] = mapped_column(String(512))
    factory_address: Mapped[str | None] = mapped_column(String(512))
    address_line1: Mapped[str | None] = mapped_column(String(255))
    address_line2: Mapped[str | None] = mapped_column(String(255))
    landmark: Mapped[str | None] = mapped_column(String(255))
    city: Mapped[str | None] = mapped_column(String(128))
    state: Mapped[str | None] = mapped_column(String(128))
    country: Mapped[str | None] = mapped_column(String(64), default="India")
    pincode: Mapped[str | None] = mapped_column(String(16))
    bank_name: Mapped[str | None] = mapped_column(String(255))
    account_holder_name: Mapped[str | None] = mapped_column(String(255))
    account_number: Mapped[str | None] = mapped_column(String(64))
    ifsc: Mapped[str | None] = mapped_column(String(32))
    bank_branch: Mapped[str | None] = mapped_column(String(255))
    upi_id: Mapped[str | None] = mapped_column(String(128))
    payment_terms: Mapped[str | None] = mapped_column(String(64))
    currency: Mapped[str | None] = mapped_column(String(16), default="INR")
    credit_limit: Mapped[float | None] = mapped_column(Numeric(14, 2))
    credit_days: Mapped[int | None] = mapped_column(Integer)
    lead_time_days: Mapped[int | None] = mapped_column(Integer)
    minimum_order_quantity: Mapped[float | None] = mapped_column(Numeric(12, 2))
    minimum_order_value: Mapped[float | None] = mapped_column(Numeric(14, 2))
    preferred_vendor: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    outstanding: Mapped[float | None] = mapped_column(Numeric(12, 2), default=0.0)
    rating: Mapped[float | None] = mapped_column(Numeric(3, 1))
    quality_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    delivery_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    price_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    service_score: Mapped[float | None] = mapped_column(Numeric(5, 2))
    on_time_delivery_percentage: Mapped[float | None] = mapped_column(Numeric(5, 2))
    rejection_percentage: Mapped[float | None] = mapped_column(Numeric(5, 2))
    onboarding_date: Mapped[date | None] = mapped_column(Date)
    created_by: Mapped[str | None] = mapped_column(String(255))
    updated_by: Mapped[str | None] = mapped_column(String(255))
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    deleted_at: Mapped[date | None] = mapped_column(Date)

    inventory_items = relationship("InventoryItem", back_populates="supplier")
    purchase_orders = relationship("PurchaseOrder", back_populates="supplier")
    vendor_products = relationship(
        "VendorProduct",
        back_populates="vendor",
        cascade="all, delete-orphan",
    )


class VendorProduct(Base, TimestampMixin):
    """Many-to-many link between vendors (suppliers) and Product Master."""

    __tablename__ = "vendor_products"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    vendor_id: Mapped[int] = mapped_column(
        ForeignKey("suppliers.id"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(
        ForeignKey("products.id"), nullable=False, index=True
    )

    vendor = relationship("Supplier", back_populates="vendor_products")
    product = relationship("Product")


class InventoryItem(Base, TimestampMixin):
    __tablename__ = "inventory_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    sku: Mapped[str] = mapped_column(String(64), nullable=False)
    barcode: Mapped[str | None] = mapped_column(String(128))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(32), default="pcs", nullable=False)
    unit_cost: Mapped[float | None] = mapped_column(Numeric(12, 2))
    reorder_level: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    item_type: Mapped[str] = mapped_column(
        String(32), default="raw_material", nullable=False
    )  # raw_material, finished_good
    category: Mapped[str | None] = mapped_column(String(128))
    warehouse_name: Mapped[str | None] = mapped_column(String(128))
    batch_number: Mapped[str | None] = mapped_column(String(128))
    quantity: Mapped[int | None] = mapped_column(Integer, default=0)
    reserved: Mapped[int | None] = mapped_column(Integer, default=0)
    status: Mapped[str | None] = mapped_column(String(64), default="in_stock")
    customer_name: Mapped[str | None] = mapped_column(String(255))
    serial_number: Mapped[str | None] = mapped_column(String(128))
    expiry_date: Mapped[str | None] = mapped_column(String(64))
    production_date: Mapped[str | None] = mapped_column(String(64))
    warranty: Mapped[str | None] = mapped_column(String(128))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    supplier = relationship("Supplier", back_populates="inventory_items")
    stock_levels = relationship(
        "StockLevel", back_populates="item", cascade="all, delete-orphan"
    )


class StockLevel(Base, TimestampMixin):
    __tablename__ = "stock_levels"
    __table_args__ = (
        UniqueConstraint(
            "warehouse_id", "item_id", name="uq_stock_levels_warehouse_item"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    warehouse = relationship("Warehouse", back_populates="stock_levels")
    item = relationship("InventoryItem", back_populates="stock_levels")


class StockMovement(Base, TimestampMixin):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id"), nullable=False, index=True
    )
    item_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_items.id"), nullable=False, index=True
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    movement_type: Mapped[str] = mapped_column(
        String(32), nullable=False
    )  # in, out, adjustment, transfer, purchase, production, sales, return, scrap
    reference: Mapped[str | None] = mapped_column(String(128))
    batch_number: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(String(255))


class StockTransfer(Base, TimestampMixin):
    __tablename__ = "stock_transfers"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    transfer_number: Mapped[str] = mapped_column(String(64), nullable=False)
    from_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    to_warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    batch_number: Mapped[str | None] = mapped_column(String(64))
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    vehicle: Mapped[str | None] = mapped_column(String(128))
    driver: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255))
    transfer_date: Mapped[date | None] = mapped_column(Date)


class StockAdjustment(Base, TimestampMixin):
    __tablename__ = "stock_adjustments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"))
    old_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    new_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    difference: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    reason: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255))
    adjustment_date: Mapped[date | None] = mapped_column(Date)


class StockReturn(Base, TimestampMixin):
    """Multi-line stock return document with approval workflow."""

    __tablename__ = "stock_returns"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    return_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    return_date: Mapped[date | None] = mapped_column(Date)
    return_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_no: Mapped[str | None] = mapped_column(String(128))
    reference_type: Mapped[str | None] = mapped_column(String(64))
    reference_id: Mapped[int | None] = mapped_column(Integer)
    department: Mapped[str | None] = mapped_column(String(64))
    returned_by: Mapped[str | None] = mapped_column(String(255))
    returned_by_user_id: Mapped[int | None] = mapped_column(Integer)
    return_to_warehouse_id: Mapped[int] = mapped_column(
        ForeignKey("warehouses.id"), nullable=False
    )
    reason: Mapped[str | None] = mapped_column(String(128))
    remarks: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    total_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(255))
    updated_by: Mapped[str | None] = mapped_column(String(255))
    verified_by: Mapped[str | None] = mapped_column(String(255))
    quality_checked_by: Mapped[str | None] = mapped_column(String(255))
    completed_by: Mapped[str | None] = mapped_column(String(255))
    rejected_by: Mapped[str | None] = mapped_column(String(255))
    rejection_reason: Mapped[str | None] = mapped_column(Text)

    lines = relationship(
        "StockReturnLine",
        back_populates="stock_return",
        cascade="all, delete-orphan",
        order_by="StockReturnLine.line_no",
    )
    warehouse = relationship("Warehouse", foreign_keys=[return_to_warehouse_id])


class StockReturnLine(Base, TimestampMixin):
    __tablename__ = "stock_return_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_return_id: Mapped[int] = mapped_column(
        ForeignKey("stock_returns.id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    batch_number: Mapped[str | None] = mapped_column(String(64))
    available_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    return_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="pcs", nullable=False)
    condition: Mapped[str] = mapped_column(String(32), default="good", nullable=False)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    line_reason: Mapped[str | None] = mapped_column(String(128))

    stock_return = relationship("StockReturn", back_populates="lines")
    item = relationship("InventoryItem")
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])


class StockInDocument(Base, TimestampMixin):
    """Multi-line stock-in (goods receipt) document with draft/confirm workflow."""

    __tablename__ = "stock_in_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    stock_in_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    stock_in_date: Mapped[date | None] = mapped_column(Date)
    reference_type: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_no: Mapped[str | None] = mapped_column(String(128))
    reference_id: Mapped[int | None] = mapped_column(Integer)
    supplier_id: Mapped[int | None] = mapped_column(ForeignKey("suppliers.id"))
    supplier_name: Mapped[str | None] = mapped_column(String(255))
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    storage_location: Mapped[str | None] = mapped_column(String(128))
    received_by: Mapped[str | None] = mapped_column(String(255))
    received_by_user_id: Mapped[int | None] = mapped_column(Integer)
    remarks: Mapped[str | None] = mapped_column(Text)
    attachments_json: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    total_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_by: Mapped[str | None] = mapped_column(String(255))
    updated_by: Mapped[str | None] = mapped_column(String(255))
    confirmed_by: Mapped[str | None] = mapped_column(String(255))
    confirmed_at: Mapped[date | None] = mapped_column(Date)

    lines = relationship(
        "StockInLine",
        back_populates="stock_in",
        cascade="all, delete-orphan",
        order_by="StockInLine.line_no",
    )
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    supplier = relationship("Supplier", foreign_keys=[supplier_id])


class StockInLine(Base, TimestampMixin):
    __tablename__ = "stock_in_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    stock_in_id: Mapped[int] = mapped_column(
        ForeignKey("stock_in_documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    ordered_qty: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    received_qty: Mapped[int] = mapped_column(Integer, nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="pcs", nullable=False)
    batch_number: Mapped[str | None] = mapped_column(String(64))
    lot_number: Mapped[str | None] = mapped_column(String(64))
    manufacturing_date: Mapped[date | None] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    storage_location: Mapped[str | None] = mapped_column(String(128))
    line_remarks: Mapped[str | None] = mapped_column(String(255))

    stock_in = relationship("StockInDocument", back_populates="lines")
    item = relationship("InventoryItem")


class StoreIssueRequest(Base, TimestampMixin):
    """Shop-floor material request → issue → confirm → consume workflow."""

    __tablename__ = "store_issue_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    request_number: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    operator_name: Mapped[str] = mapped_column(String(255), nullable=False)
    employee_id: Mapped[str | None] = mapped_column(String(64))
    machine: Mapped[str | None] = mapped_column(String(128))
    shift: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(String(512))
    # pending → approved → issued → received → closed | rejected
    status: Mapped[str] = mapped_column(String(32), default="pending", nullable=False)
    approved_by: Mapped[str | None] = mapped_column(String(255))
    issued_by: Mapped[str | None] = mapped_column(String(255))
    issued_qty: Mapped[int | None] = mapped_column(Integer)
    used_qty: Mapped[int | None] = mapped_column(Integer)
    waste_qty: Mapped[int | None] = mapped_column(Integer)
    returned_qty: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
