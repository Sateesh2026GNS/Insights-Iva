from datetime import date
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ExportPackingCartonRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    carton_no: str
    sku_code: str | None = None
    item_description: str
    qty_pcs: int
    net_weight_kg: float | None = None
    gross_weight_kg: float | None = None
    dim_length_cm: float | None = None
    dim_width_cm: float | None = None
    dim_height_cm: float | None = None
    marks_numbers: str | None = None
    package_type: str | None = None

    @property
    def dimensions_label(self) -> str:
        if self.dim_length_cm and self.dim_width_cm and self.dim_height_cm:
            return f"{self.dim_length_cm:g}x{self.dim_width_cm:g}x{self.dim_height_cm:g}"
        return "—"


class ExportPackingListSummaryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    packing_list_no: str
    shipment_no: str
    destination: str | None = None
    dispatch_date: date | None = None
    cartons_prepared: int = 0
    status: str


class ExportPackingDashboardRead(BaseModel):
    packing_list: dict[str, Any] | None = None
    kpis: dict[str, Any] = Field(default_factory=dict)
    cartons: list[dict[str, Any]] = Field(default_factory=list)
    weight_summary: list[dict[str, Any]] = Field(default_factory=list)
    package_type_distribution: list[dict[str, Any]] = Field(default_factory=list)
    sku_quantity_summary: list[dict[str, Any]] = Field(default_factory=list)
    item_master: list[dict[str, Any]] = Field(default_factory=list)
    document_checklist: list[dict[str, Any]] = Field(default_factory=list)
    recent_packing_lists: list[dict[str, Any]] = Field(default_factory=list)
    validation: dict[str, Any] = Field(default_factory=dict)


class ExportPackingValidateRead(BaseModel):
    ok: bool
    messages: list[str] = Field(default_factory=list)


class ExportPackingListCreate(BaseModel):
    packing_list_no: str
    shipment_no: str
    destination: str | None = None
    container_no: str | None = None
    dispatch_date: date | None = None
    status: str = "draft"
    gross_weight_kg: float | None = None
    net_weight_kg: float | None = None
    cartons_planned: int = 0
    cartons_prepared: int = 0
    remarks: str | None = None
    prepared_by_name: str | None = None
    dispatch_shipment_id: int | None = None


class ExportPackingListUpdate(BaseModel):
    packing_list_no: str | None = None
    shipment_no: str | None = None
    destination: str | None = None
    container_no: str | None = None
    dispatch_date: date | None = None
    status: str | None = None
    gross_weight_kg: float | None = None
    net_weight_kg: float | None = None
    cartons_planned: int | None = None
    cartons_prepared: int | None = None
    remarks: str | None = None
    prepared_by_name: str | None = None
    dispatch_shipment_id: int | None = None
    document_checklist: list[dict[str, Any]] | None = None


class ExportPackingCartonCreate(BaseModel):
    carton_no: str
    sku_code: str | None = None
    item_description: str
    qty_pcs: int = 0
    net_weight_kg: float | None = None
    gross_weight_kg: float | None = None
    dim_length_cm: float | None = None
    dim_width_cm: float | None = None
    dim_height_cm: float | None = None
    marks_numbers: str | None = None
    package_type: str | None = "standard_carton"


class ExportPackingCartonUpdate(BaseModel):
    carton_no: str | None = None
    sku_code: str | None = None
    item_description: str | None = None
    qty_pcs: int | None = None
    net_weight_kg: float | None = None
    gross_weight_kg: float | None = None
    dim_length_cm: float | None = None
    dim_width_cm: float | None = None
    dim_height_cm: float | None = None
    marks_numbers: str | None = None
    package_type: str | None = None


class DispatchShipmentOptionRead(BaseModel):
    id: int
    dispatch_number: str
    dispatch_date: date | None = None
    status: str | None = None
    box_count: int | None = None
    total_weight: float | None = None
