from pydantic import BaseModel, Field


class LayoutWrite(BaseModel):
    length_ft: float | None = Field(default=None, ge=0)
    breadth_ft: float | None = Field(default=None, ge=0)
    clear_height_ft: float | None = Field(default=None, ge=0)
    aisle_pct: float | None = Field(default=None, ge=0, lt=100)


class ItemProfileWrite(BaseModel):
    weight_kg_per_unit: float | None = Field(default=None, ge=0)
    volume_cft_per_unit: float | None = Field(default=None, ge=0)
    units_per_stack: float | None = Field(default=None, gt=0)
    stack_area_sqft: float | None = Field(default=None, ge=0)


class EoqWrite(BaseModel):
    item_id: int = Field(..., ge=1)
    annual_demand: float | None = Field(default=None, gt=0)
    order_cost: float | None = Field(default=None, gt=0)
    holding_pct: float | None = Field(default=None, gt=0)
    holding_cost_per_unit: float | None = Field(default=None, gt=0)
    unit_cost: float | None = Field(default=None, ge=0)
    client_request_id: str | None = Field(default=None, max_length=64)


class LabourWrite(BaseModel):
    warehouse_id: int | None = Field(default=None, ge=1)
    work_date: str
    work_type: str = Field(..., min_length=1, max_length=64)
    basis: str
    quantity: float = Field(..., gt=0)
    rate: float = Field(..., ge=0)
    is_estimate: bool = False
    reference: str | None = Field(default=None, max_length=128)
    remarks: str | None = None
    client_request_id: str | None = Field(default=None, max_length=64)


class TruckLineWrite(BaseModel):
    item_id: int = Field(..., ge=1)
    quantity: float = Field(..., gt=0)


class TruckPlanWrite(BaseModel):
    warehouse_id: int = Field(..., ge=1)
    vehicle_label: str = Field(..., min_length=1, max_length=128)
    capacity_kg: float | None = Field(default=None, gt=0)
    capacity_cft: float | None = Field(default=None, gt=0)
    notes: str | None = None
    lines: list[TruckLineWrite] = Field(..., min_length=1)
    client_request_id: str | None = Field(default=None, max_length=64)


class LossWrite(BaseModel):
    warehouse_id: int = Field(..., ge=1)
    item_id: int = Field(..., ge=1)
    quantity: float = Field(..., gt=0)
    reason: str
    adjustment_date: str | None = None
    remarks: str | None = None


class QuoteLineWrite(BaseModel):
    item_id: int | None = Field(default=None, ge=1)
    description: str | None = Field(default=None, max_length=255)
    quantity: float = Field(..., gt=0)
    rate: float = Field(..., ge=0)


class QuoteWrite(BaseModel):
    customer_id: int = Field(..., ge=1)
    warehouse_id: int | None = Field(default=None, ge=1)
    quote_date: str
    valid_until: str | None = None
    discount: float = Field(default=0, ge=0)
    tax_pct: float | None = Field(default=None, ge=0)
    use_company_tax: bool = False
    notes: str | None = None
    lines: list[QuoteLineWrite] = Field(..., min_length=1)
    client_request_id: str | None = Field(default=None, max_length=64)


class StatusWrite(BaseModel):
    status: str = Field(..., min_length=1, max_length=32)


class GateLineWrite(BaseModel):
    item_id: int = Field(..., ge=1)
    quantity: float = Field(..., gt=0)
    remark: str | None = Field(default=None, max_length=255)


class GatePassWrite(BaseModel):
    document_type: str
    document_date: str
    warehouse_id: int | None = Field(default=None, ge=1)
    customer_id: int | None = Field(default=None, ge=1)
    party_name: str | None = Field(default=None, max_length=255)
    vehicle_no: str | None = Field(default=None, max_length=64)
    driver_name: str | None = Field(default=None, max_length=255)
    driver_phone: str | None = Field(default=None, max_length=64)
    purpose: str | None = Field(default=None, max_length=255)
    reference: str | None = Field(default=None, max_length=128)
    remarks: str | None = None
    lines: list[GateLineWrite] = Field(..., min_length=1)
    client_request_id: str | None = Field(default=None, max_length=64)
