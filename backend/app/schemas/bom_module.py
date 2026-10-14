from datetime import date, datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class BomComponentLineIn(BaseModel):
    component_item_id: int = Field(..., ge=1)
    quantity: Decimal = Field(..., gt=0)
    uom: str = Field(..., min_length=1, max_length=32)
    scrap_percent: Decimal = Field(default=Decimal("0"), ge=0, lt=100)
    notes: str | None = None
    line_no: int | None = None


class BomVersionDraftIn(BaseModel):
    base_quantity: Decimal = Field(..., gt=0)
    base_uom: str = Field(..., min_length=1, max_length=32)
    effective_from: date | None = None
    notes: str | None = None
    components: list[BomComponentLineIn] = Field(..., min_length=1)


class BomCreate(BaseModel):
    bom_code: str | None = Field(None, max_length=64)
    product_id: int = Field(..., ge=1)
    name: str = Field(..., min_length=1, max_length=255)
    version: BomVersionDraftIn


class BomVersionUpdate(BomVersionDraftIn):
    pass


class BomComponentLineRead(BaseModel):
    id: int
    line_no: int
    component_item_id: int
    component_name: str | None = None
    component_type: str
    quantity: Decimal
    uom: str
    scrap_percent: Decimal
    gross_quantity: Decimal
    notes: str | None = None
    unit_cost: Decimal | None = None
    line_cost: Decimal | None = None
    missing_price: bool = False
    vendor_name: str | None = None
    sub_assembly_bom_id: int | None = None
    model_config = ConfigDict(from_attributes=True)


class BomCostSummary(BaseModel):
    total_cost: Decimal | None = None
    cost_per_base: Decimal | None = None
    cost_per_unit: Decimal | None = None
    incomplete: bool = False


class BomVersionRead(BaseModel):
    id: int
    version_number: int
    status: str
    base_quantity: Decimal
    base_uom: str
    effective_from: date | None
    effective_to: date | None
    notes: str | None
    created_at: datetime | None
    activated_at: datetime | None
    components: list[BomComponentLineRead] = []
    cost: BomCostSummary | None = None
    model_config = ConfigDict(from_attributes=True)


class BomListItem(BaseModel):
    id: int
    bom_code: str
    name: str
    product_id: int
    product_name: str | None
    product_sku: str | None
    active_version_number: int | None
    status: str | None
    component_count: int
    cost_per_unit: Decimal | None = None
    cost_incomplete: bool | None = None
    updated_at: datetime | None


class BomListResponse(BaseModel):
    items: list[BomListItem]
    total: int
    page: int
    page_size: int


class BomSummaryResponse(BaseModel):
    total_boms: int
    products_without_active_bom: int
    drafts_pending_activation: int


class BomDetailRead(BaseModel):
    id: int
    bom_code: str
    name: str
    product_id: int
    product_name: str | None
    is_archived: bool
    open_work_orders: int
    version: BomVersionRead
    model_config = ConfigDict(from_attributes=True)


class BomVersionHistoryItem(BaseModel):
    id: int
    version_number: int
    status: str
    created_at: datetime | None
    created_by_name: str | None
    activated_at: datetime | None
    activated_by_name: str | None
    change_summary: list[str] = []


class BomWhereUsedOrder(BaseModel):
    production_order_id: int
    order_number: str
    work_order_id: int | None
    work_order_number: str | None
    status: str
    planned_quantity: Decimal
    bom_version_number: int


class BomWhereUsedRead(BaseModel):
    version_id: int
    version_number: int
    status: str
    open_orders: list[BomWhereUsedOrder] = []
    past_orders: list[BomWhereUsedOrder] = []


class BomRequirementLine(BaseModel):
    component_item_id: int
    component_name: str
    uom: str
    required_qty: Any
    available_qty: Any | None = None
    shortage_qty: Any | None = None
    status: str
    error: str | None = None
    item_id: int | None = None
    bom_component_id: int | None = None


class BomRequirementResponse(BaseModel):
    quantity: Decimal
    version_id: int
    version_number: int
    lines: list[BomRequirementLine]


class BomPurchaseIndentRequest(BaseModel):
    quantity: Decimal = Field(..., gt=0)
    component_item_ids: list[int] = Field(..., min_length=1)


class BomPurchaseIndentResponse(BaseModel):
    material_request_id: int
    mr_number: str
