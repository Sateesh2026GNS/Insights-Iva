"""Manufacturing workflow persistence — material checks and transition audit."""

from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class SalesOrderMaterialCheck(Base, TimestampMixin):
    """Inventory material verification job card linked to a sales order."""

    __tablename__ = "sales_order_material_checks"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id"), nullable=False, index=True
    )
    check_number: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), default="pending", nullable=False
    )  # pending | available | shortage | partial
    verified_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    verified_by_name: Mapped[str | None] = mapped_column(String(255))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    lines = relationship(
        "SalesOrderMaterialCheckLine",
        back_populates="material_check",
        cascade="all, delete-orphan",
    )


class SalesOrderMaterialCheckLine(Base, TimestampMixin):
    __tablename__ = "sales_order_material_check_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    material_check_id: Mapped[int] = mapped_column(
        ForeignKey("sales_order_material_checks.id"), nullable=False, index=True
    )
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    inventory_item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id"))
    material_name: Mapped[str] = mapped_column(String(255), nullable=False)
    required_qty: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    available_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    shortage_qty: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    stock_location: Mapped[str | None] = mapped_column(String(255))
    is_available: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    material_check = relationship("SalesOrderMaterialCheck", back_populates="lines")


class SalesJobCard(Base, TimestampMixin):
    """Persisted sales-order job card document (created by Sales team)."""

    __tablename__ = "sales_job_cards"
    __table_args__ = (
        UniqueConstraint("tenant_id", "job_card_no", name="uq_sales_job_cards_tenant_no"),
        UniqueConstraint("tenant_id", "sales_order_id", name="uq_sales_job_cards_tenant_so"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    job_card_no: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id"), nullable=False, index=True
    )
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False)
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False, default="Nos")
    required_delivery_date: Mapped[date | None] = mapped_column(Date)
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="medium")
    sales_person_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    sales_person_name: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="draft"
    )  # draft | created
    workflow_stage: Mapped[str | None] = mapped_column(String(64))
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))


class ManufacturingWorkflowTransition(Base, TimestampMixin):
    """Audit trail for workflow status changes on sales orders."""

    __tablename__ = "manufacturing_workflow_transitions"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(
        ForeignKey("tenants.id"), nullable=False, index=True
    )
    sales_order_id: Mapped[int] = mapped_column(
        ForeignKey("sales_orders.id"), nullable=False, index=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_status: Mapped[str | None] = mapped_column(String(64))
    new_status: Mapped[str] = mapped_column(String(64), nullable=False)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    user_name: Mapped[str | None] = mapped_column(String(255))
    user_role: Mapped[str | None] = mapped_column(String(128))
    team: Mapped[str | None] = mapped_column(String(64))
    work_order_id: Mapped[int | None] = mapped_column(ForeignKey("work_orders.id"))
    quality_inspection_id: Mapped[int | None] = mapped_column(
        ForeignKey("quality_inspections.id")
    )
    dispatch_id: Mapped[int | None] = mapped_column(ForeignKey("dispatch_shipments.id"))
    invoice_id: Mapped[int | None] = mapped_column(ForeignKey("invoices.id"))
    details: Mapped[str | None] = mapped_column(Text)
