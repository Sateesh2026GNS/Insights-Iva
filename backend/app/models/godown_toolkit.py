"""Persistence that the godown toolkit needs and the ERP did not already have.

Stock, warehouses, items, customers, and stock adjustments stay on their existing tables.
"""

from datetime import date

from sqlalchemy import Boolean, Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ItemPhysicalProfile(Base, TimestampMixin):
    """Optional, user-configured weight, volume, and stack size for one item."""

    __tablename__ = "item_physical_profiles"
    __table_args__ = (UniqueConstraint("item_id", name="uq_item_physical_profiles_item"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False, index=True)
    weight_kg_per_unit: Mapped[float | None] = mapped_column(Numeric(14, 4))
    volume_cft_per_unit: Mapped[float | None] = mapped_column(Numeric(14, 4))
    units_per_stack: Mapped[float | None] = mapped_column(Numeric(14, 4))
    stack_area_sqft: Mapped[float | None] = mapped_column(Numeric(14, 4))


class WarehouseLayout(Base, TimestampMixin):
    """Optional floor dimensions. Stock quantity is not treated as floor area."""

    __tablename__ = "warehouse_layouts"
    __table_args__ = (UniqueConstraint("warehouse_id", name="uq_warehouse_layouts_warehouse"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False, index=True)
    length_ft: Mapped[float | None] = mapped_column(Numeric(12, 2))
    breadth_ft: Mapped[float | None] = mapped_column(Numeric(12, 2))
    clear_height_ft: Mapped[float | None] = mapped_column(Numeric(12, 2))
    aisle_pct: Mapped[float | None] = mapped_column(Numeric(5, 2))


class GodownLabourEntry(Base, TimestampMixin):
    __tablename__ = "godown_labour_entries"
    __table_args__ = (
        UniqueConstraint("tenant_id", "client_request_id", name="uq_godown_labour_client_request"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    work_date: Mapped[date] = mapped_column(Date, nullable=False)
    work_type: Mapped[str] = mapped_column(String(64), nullable=False)
    basis: Mapped[str] = mapped_column(String(16), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    is_estimate: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    reference: Mapped[str | None] = mapped_column(String(128))
    remarks: Mapped[str | None] = mapped_column(Text)
    client_request_id: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(String(255))


class TruckLoadPlan(Base, TimestampMixin):
    __tablename__ = "truck_load_plans"
    __table_args__ = (
        UniqueConstraint("tenant_id", "client_request_id", name="uq_truck_load_plans_client_request"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False, index=True)
    vehicle_label: Mapped[str] = mapped_column(String(128), nullable=False)
    capacity_kg: Mapped[float | None] = mapped_column(Numeric(14, 2))
    capacity_cft: Mapped[float | None] = mapped_column(Numeric(14, 2))
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    weight_status: Mapped[str] = mapped_column(String(32), nullable=False)
    volume_status: Mapped[str] = mapped_column(String(32), nullable=False)
    total_units: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_kg: Mapped[float | None] = mapped_column(Numeric(14, 2))
    total_cft: Mapped[float | None] = mapped_column(Numeric(14, 2))
    client_request_id: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)


class TruckLoadPlanLine(Base, TimestampMixin):
    __tablename__ = "truck_load_plan_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    plan_id: Mapped[int] = mapped_column(ForeignKey("truck_load_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(14, 2))
    volume_cft: Mapped[float | None] = mapped_column(Numeric(14, 2))


class StorageQuotation(Base, TimestampMixin):
    __tablename__ = "storage_quotations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "quote_number", name="uq_storage_quotations_tenant_number"),
        UniqueConstraint("tenant_id", "client_request_id", name="uq_storage_quotations_client_request"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    quote_number: Mapped[str] = mapped_column(String(64), nullable=False)
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), nullable=False, index=True)
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    quote_date: Mapped[date] = mapped_column(Date, nullable=False)
    valid_until: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    discount: Mapped[float] = mapped_column(Numeric(14, 2), default=0, nullable=False)
    tax_pct: Mapped[float | None] = mapped_column(Numeric(6, 2))
    tax_amount: Mapped[float | None] = mapped_column(Numeric(14, 2))
    tax_status: Mapped[str] = mapped_column(String(32), nullable=False)
    tax_source: Mapped[str | None] = mapped_column(String(32))
    total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    client_request_id: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(String(255))


class StorageQuotationLine(Base, TimestampMixin):
    __tablename__ = "storage_quotation_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    quotation_id: Mapped[int] = mapped_column(
        ForeignKey("storage_quotations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("inventory_items.id"))
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    rate: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)


class GatePass(Base, TimestampMixin):
    __tablename__ = "gate_passes"
    __table_args__ = (
        UniqueConstraint("tenant_id", "document_no", name="uq_gate_passes_tenant_document"),
        UniqueConstraint("tenant_id", "client_request_id", name="uq_gate_passes_client_request"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    document_no: Mapped[str] = mapped_column(String(64), nullable=False)
    document_type: Mapped[str] = mapped_column(String(32), nullable=False)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    document_date: Mapped[date] = mapped_column(Date, nullable=False)
    warehouse_id: Mapped[int | None] = mapped_column(ForeignKey("warehouses.id"))
    customer_id: Mapped[int | None] = mapped_column(ForeignKey("customers.id"))
    party_name: Mapped[str | None] = mapped_column(String(255))
    vehicle_no: Mapped[str | None] = mapped_column(String(64))
    driver_name: Mapped[str | None] = mapped_column(String(255))
    driver_phone: Mapped[str | None] = mapped_column(String(64))
    purpose: Mapped[str | None] = mapped_column(String(255))
    reference: Mapped[str | None] = mapped_column(String(128))
    remarks: Mapped[str | None] = mapped_column(Text)
    client_request_id: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(String(255))


class GatePassLine(Base, TimestampMixin):
    __tablename__ = "gate_pass_lines"

    id: Mapped[int] = mapped_column(primary_key=True)
    gate_pass_id: Mapped[int] = mapped_column(ForeignKey("gate_passes.id", ondelete="CASCADE"), nullable=False, index=True)
    line_no: Mapped[int] = mapped_column(Integer, nullable=False)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    unit: Mapped[str] = mapped_column(String(32), nullable=False)
    weight_kg: Mapped[float | None] = mapped_column(Numeric(14, 2))
    remark: Mapped[str | None] = mapped_column(String(255))


class EoqCalculation(Base, TimestampMixin):
    __tablename__ = "eoq_calculations"
    __table_args__ = (
        UniqueConstraint("tenant_id", "client_request_id", name="uq_eoq_calculations_client_request"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("inventory_items.id"), nullable=False, index=True)
    annual_demand: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    demand_source: Mapped[str] = mapped_column(String(32), nullable=False)
    order_cost: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    order_cost_source: Mapped[str] = mapped_column(String(32), nullable=False)
    holding_pct: Mapped[float | None] = mapped_column(Numeric(8, 4))
    unit_cost: Mapped[float | None] = mapped_column(Numeric(14, 4))
    unit_cost_source: Mapped[str | None] = mapped_column(String(32))
    holding_cost_per_unit: Mapped[float] = mapped_column(Numeric(14, 4), nullable=False)
    eoq: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    client_request_id: Mapped[str | None] = mapped_column(String(64))
    created_by: Mapped[str | None] = mapped_column(String(255))
