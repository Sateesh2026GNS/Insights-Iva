from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin


class ExportPackingList(Base, TimestampMixin):
    __tablename__ = "export_packing_lists"
    __table_args__ = (UniqueConstraint("tenant_id", "packing_list_no", name="uq_export_packing_lists_tenant_no"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    packing_list_no: Mapped[str] = mapped_column(String(64), nullable=False)
    shipment_no: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    destination: Mapped[str | None] = mapped_column(String(255))
    container_no: Mapped[str | None] = mapped_column(String(64))
    dispatch_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="draft", nullable=False)
    gross_weight_kg: Mapped[float | None] = mapped_column(Numeric(14, 2))
    net_weight_kg: Mapped[float | None] = mapped_column(Numeric(14, 2))
    cartons_planned: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    cartons_prepared: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    remarks: Mapped[str | None] = mapped_column(Text)
    prepared_by_name: Mapped[str | None] = mapped_column(String(255))
    dispatch_shipment_id: Mapped[int | None] = mapped_column(
        ForeignKey("dispatch_shipments.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    document_checklist_json: Mapped[str | None] = mapped_column(Text)

    cartons = relationship(
        "ExportPackingListCarton",
        back_populates="packing_list",
        cascade="all, delete-orphan",
    )


class ExportPackingListCarton(Base, TimestampMixin):
    __tablename__ = "export_packing_list_cartons"

    id: Mapped[int] = mapped_column(primary_key=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id"), nullable=False, index=True)
    packing_list_id: Mapped[int] = mapped_column(
        ForeignKey("export_packing_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    carton_no: Mapped[str] = mapped_column(String(32), nullable=False)
    sku_code: Mapped[str | None] = mapped_column(String(64))
    item_description: Mapped[str] = mapped_column(String(512), nullable=False)
    qty_pcs: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    net_weight_kg: Mapped[float | None] = mapped_column(Numeric(12, 2))
    gross_weight_kg: Mapped[float | None] = mapped_column(Numeric(12, 2))
    dim_length_cm: Mapped[float | None] = mapped_column(Numeric(8, 2))
    dim_width_cm: Mapped[float | None] = mapped_column(Numeric(8, 2))
    dim_height_cm: Mapped[float | None] = mapped_column(Numeric(8, 2))
    marks_numbers: Mapped[str | None] = mapped_column(String(255))
    package_type: Mapped[str | None] = mapped_column(String(64))

    packing_list = relationship("ExportPackingList", back_populates="cartons")
