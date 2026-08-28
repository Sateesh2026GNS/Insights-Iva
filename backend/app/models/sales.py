from datetime import date, datetime

from sqlalchemy import Boolean, Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class Lead(Base, TimestampMixin):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    company: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    source: Mapped[str | None] = mapped_column(String(128))
    status: Mapped[str] = mapped_column(String(32), default="new", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    sales_executive: Mapped[str | None] = mapped_column(String(255))
    industry: Mapped[str | None] = mapped_column(String(128))
    region: Mapped[str | None] = mapped_column(String(128))
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    next_followup: Mapped[date | None] = mapped_column(Date)
    opportunity_value: Mapped[float | None] = mapped_column(Numeric(12, 2))

    activities = relationship(
        "LeadActivity",
        back_populates="lead",
        cascade="all, delete-orphan",
        order_by="LeadActivity.id.desc()",
    )


class LeadActivity(Base, TimestampMixin):
    __tablename__ = "lead_activities"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    lead_id: Mapped[int] = mapped_column(
        ForeignKey("leads.id", ondelete="CASCADE"), nullable=False, index=True
    )
    activity_type: Mapped[str] = mapped_column(String(64), default="Call", nullable=False)
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    user_name: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)

    lead = relationship("Lead", back_populates="activities")


class Quotation(Base, TimestampMixin):
    __tablename__ = "quotations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "quote_number", name="uq_quotations_tenant_quote_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    quote_number: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"))
    customer_name: Mapped[str | None] = mapped_column(String(255))
    quote_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    sales_person: Mapped[str | None] = mapped_column(String(255))
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    gst_amount: Mapped[float | None] = mapped_column(Numeric(12, 2))
    freight: Mapped[float | None] = mapped_column(Numeric(12, 2))
    meta_json: Mapped[str | None] = mapped_column(Text)

    customer = relationship("Customer")
    lead = relationship("Lead")


class Customer(Base, TimestampMixin):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    address_line1: Mapped[str | None] = mapped_column(String(512))
    address_line2: Mapped[str | None] = mapped_column(String(512))
    city: Mapped[str | None] = mapped_column(String(128))
    pincode: Mapped[str | None] = mapped_column(String(16))
    state: Mapped[str | None] = mapped_column(String(128))
    state_code: Mapped[str | None] = mapped_column(String(16))
    gstin: Mapped[str | None] = mapped_column(String(64))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    customer_code: Mapped[str | None] = mapped_column(String(64))
    credit_limit: Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    outstanding: Mapped[float | None] = mapped_column(Numeric(14, 2), default=0)
    status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)

    sales_orders = relationship("SalesOrder", back_populates="customer")
    invoices = relationship("Invoice", back_populates="customer")


class SalesOrder(Base, TimestampMixin):
    __tablename__ = "sales_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    order_number: Mapped[str] = mapped_column(String(64), nullable=False)
    reference_number: Mapped[str | None] = mapped_column(String(64))
    order_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    invoiced: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    packed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    shipped: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    delivery_date: Mapped[date | None] = mapped_column(Date)
    payment_terms: Mapped[str | None] = mapped_column(String(128))
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    sales_person: Mapped[str | None] = mapped_column(String(255))
    priority: Mapped[str] = mapped_column(String(16), default="medium", nullable=False)
    workflow_status: Mapped[str | None] = mapped_column(String(64), index=True)

    customer = relationship("Customer", back_populates="sales_orders")
    invoices = relationship("Invoice", back_populates="sales_order")
    dispatches = relationship("DispatchShipment", back_populates="sales_order")
    line_items = relationship(
        "SalesOrderLine",
        back_populates="sales_order",
        cascade="all, delete-orphan",
    )


class SalesOrderLine(Base, TimestampMixin):
    __tablename__ = "sales_order_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id"), nullable=False, index=True
    )
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"), index=True)
    item_description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="pcs", nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)

    sales_order = relationship("SalesOrder", back_populates="line_items")
    product = relationship("Product")


class Invoice(Base, TimestampMixin):
    __tablename__ = "invoices"
    __table_args__ = (
        UniqueConstraint("tenant_id", "invoice_number", name="uq_invoices_tenant_invoice_number"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    sales_order_id: Mapped[int | None] = mapped_column(ForeignKey("sales_orders.id"))
    invoice_number: Mapped[str] = mapped_column(String(64), nullable=False)
    invoice_prefix: Mapped[str | None] = mapped_column(String(32))
    issue_date: Mapped[date] = mapped_column(Date, nullable=False)
    due_date: Mapped[date | None] = mapped_column(Date)
    # tax_invoice | bill_of_supply | export_invoice
    document_type: Mapped[str] = mapped_column(String(32), default="tax_invoice", nullable=False)
    # active | cancelled
    invoice_status: Mapped[str] = mapped_column(String(32), default="active", nullable=False)
    # all | active | cancelled  (e-invoice lifecycle)
    e_invoice_status: Mapped[str] = mapped_column(String(32), default="all", nullable=False)
    # all | active | expired | cancelled
    e_waybill_status: Mapped[str] = mapped_column(String(32), default="all", nullable=False)
    # active | none
    export_invoice_status: Mapped[str | None] = mapped_column(String(32))
    # unpaid | paid | partial  (payment bucket for KPI tabs)
    payment_status: Mapped[str] = mapped_column(String(32), default="unpaid", nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    other_charge: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    sgst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    cgst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    igst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    sgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    cgst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    igst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    round_off: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    grand_total: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    # Optional / logistics fields (Invoice v2)
    transport_mode: Mapped[str | None] = mapped_column(String(64))
    lr_number: Mapped[str | None] = mapped_column(String(128))
    lr_date: Mapped[date | None] = mapped_column(Date)
    vehicle_no: Mapped[str | None] = mapped_column(String(64))
    distance_km: Mapped[float | None] = mapped_column(Numeric(12, 2))
    transporter_name: Mapped[str | None] = mapped_column(String(255))
    place_of_supply: Mapped[str | None] = mapped_column(String(128))
    date_of_supply: Mapped[date | None] = mapped_column(Date)
    supply_type: Mapped[str | None] = mapped_column(String(32))
    po_number: Mapped[str | None] = mapped_column(String(128))
    po_date: Mapped[date | None] = mapped_column(Date)
    challan_number: Mapped[str | None] = mapped_column(String(128))
    ewaybill_number: Mapped[str | None] = mapped_column(String(128))
    sales_person: Mapped[str | None] = mapped_column(String(255))
    reverse_charge: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms_and_conditions: Mapped[str | None] = mapped_column(Text)
    show_signature: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    stamp_url: Mapped[str | None] = mapped_column(Text)
    signature_url: Mapped[str | None] = mapped_column(Text)
    bank_details_json: Mapped[str | None] = mapped_column(Text)
    custom_fields_json: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)

    customer = relationship("Customer", back_populates="invoices")
    sales_order = relationship("SalesOrder", back_populates="invoices")
    items = relationship("InvoiceItem", back_populates="invoice", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="invoice", cascade="all, delete-orphan")


class InvoiceItem(Base, TimestampMixin):
    __tablename__ = "invoice_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False)
    item_description: Mapped[str] = mapped_column(String(512), nullable=False)
    hsn: Mapped[str | None] = mapped_column(String(32))
    qty: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), default="pcs", nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    tax_type: Mapped[str] = mapped_column(String(32), default="Exclusive", nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    discount_type: Mapped[str] = mapped_column(String(8), default="₹", nullable=False)
    taxable_value: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    gst_pct: Mapped[float] = mapped_column(Numeric(5, 2), default=0, nullable=False)
    gst_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    invoice = relationship("Invoice", back_populates="items")


class Payment(Base, TimestampMixin):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"), nullable=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_date: Mapped[date] = mapped_column(Date, nullable=False)
    method: Mapped[str] = mapped_column(String(64), default="cash", nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)

    invoice = relationship("Invoice", back_populates="payments")


class DispatchShipment(Base, TimestampMixin):
    __tablename__ = "dispatch_shipments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    dispatch_number: Mapped[str] = mapped_column(String(64), nullable=False)
    sales_order_id: Mapped[int] = mapped_column(ForeignKey("sales_orders.id"), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    courier: Mapped[str | None] = mapped_column(String(128))
    vehicle_number: Mapped[str | None] = mapped_column(String(64))
    driver_name: Mapped[str | None] = mapped_column(String(255))
    lr_number: Mapped[str | None] = mapped_column(String(64))
    dispatch_date: Mapped[date] = mapped_column(Date, nullable=False)
    eta: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="packed", nullable=False)
    tracking_url: Mapped[str | None] = mapped_column(String(512))

    sales_order = relationship("SalesOrder", back_populates="dispatches")
    customer = relationship("Customer")
