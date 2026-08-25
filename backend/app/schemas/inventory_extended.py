from datetime import date
from typing import Any

from pydantic import BaseModel, Field, field_validator, model_validator


class InventorySummaryRead(BaseModel):
    total_items: int = Field(0, ge=0)
    available_stock: int = Field(0, ge=0)
    low_stock: int = Field(0, ge=0)
    out_of_stock: int = Field(0, ge=0)
    stock_value: float = Field(0.0, ge=0.0)
    expiring_soon: int = Field(0, ge=0)
    reorder_items: int = Field(0, ge=0)


class MaterialListRead(BaseModel):
    id: int
    sku: str
    name: str
    category: str | None = None
    warehouse_name: str | None = None
    batch_number: str | None = None
    quantity: int = Field(0, ge=0)
    reserved: int = Field(0, ge=0)
    available: int = Field(0, ge=0)
    unit: str = "pcs"
    reorder_level: int = Field(0, ge=0)
    unit_cost: float | None = Field(None, ge=0.0)
    stock_value: float | None = Field(None, ge=0.0)
    status: str = "available"
    barcode: str | None = None
    vendor_name: str | None = None
    item_type: str = "raw_material"
    created_at: str | None = None


class FinishedGoodListRead(BaseModel):
    id: int
    sku: str
    name: str
    batch_number: str | None = None
    quantity: int = Field(0, ge=0)
    reserved: int = Field(0, ge=0)
    available: int = Field(0, ge=0)
    warehouse_name: str | None = None
    customer_name: str | None = None
    status: str = "available"
    production_date: str | None = None
    expiry_date: str | None = None
    warranty: str | None = None
    serial_number: str | None = None
    qr_code: str | None = None
    unit_cost: float | None = Field(None, ge=0.0)
    stock_value: float | None = Field(None, ge=0.0)
    created_at: str | None = None


class MaterialDetailRead(BaseModel):
    id: int
    sku: str
    name: str
    barcode: str | None = None
    category: str | None = None
    unit: str = "pcs"
    unit_cost: float | None = Field(None, ge=0.0)
    reorder_level: int = Field(0, ge=0)
    description: str | None = None
    vendor_name: str | None = None
    vendor_contact: str | None = None
    vendor_email: str | None = None
    stock_history: list[dict] = Field(default_factory=list)
    purchase_history: list[dict] = Field(default_factory=list)
    consumption_history: list[dict] = Field(default_factory=list)
    batches: list[dict] = Field(default_factory=list)


class StockTransferCreate(BaseModel):
    transfer_number: str | None = None
    transfer_date: str | None = None
    from_warehouse_id: int = Field(..., ge=1)
    to_warehouse_id: int = Field(..., ge=1)
    item_id: int = Field(..., ge=1)
    batch_number: str | None = None
    quantity: int = Field(..., ge=1)
    vehicle: str | None = None
    driver: str | None = None
    notes: str | None = None

    @model_validator(mode="after")
    def validate_warehouses_differ(self) -> "StockTransferCreate":
        if self.from_warehouse_id and self.to_warehouse_id and self.from_warehouse_id == self.to_warehouse_id:
            raise ValueError("Source (from_warehouse_id) and destination (to_warehouse_id) warehouses must be different.")
        return self


VALID_TRANSFER_STATUSES = {"pending", "in_transit", "completed", "cancelled", "approved", "rejected"}
VALID_ADJUSTMENT_STATUSES = {"pending", "approved", "rejected", "completed", "cancelled"}


class StockTransferStatusUpdate(BaseModel):
    status: str
    approved_by: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_transfer_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_TRANSFER_STATUSES:
                raise ValueError(f"Invalid transfer status '{v}'. Must be one of {', '.join(sorted(VALID_TRANSFER_STATUSES))}.")
            return s
        raise ValueError("Transfer status is required.")


class StockTransferRead(BaseModel):
    id: int
    transfer_number: str
    transfer_date: str | None = None
    from_warehouse: str
    to_warehouse: str
    item_name: str
    batch_number: str | None = None
    quantity: int = Field(0, ge=0)
    status: str
    approved_by: str | None = None
    vehicle: str | None = None
    driver: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_transfer_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_TRANSFER_STATUSES:
                raise ValueError(f"Invalid transfer status '{v}'. Must be one of {', '.join(sorted(VALID_TRANSFER_STATUSES))}.")
            return s
        return "pending"


class StockAdjustmentCreate(BaseModel):
    adjustment_date: str | None = None
    warehouse_id: int = Field(..., ge=1)
    item_id: int = Field(..., ge=1)
    new_qty: int = Field(..., ge=0)
    reason: str = Field(..., min_length=1)


class StockAdjustmentStatusUpdate(BaseModel):
    status: str
    approved_by: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_adjustment_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_ADJUSTMENT_STATUSES:
                raise ValueError(f"Invalid adjustment status '{v}'. Must be one of {', '.join(sorted(VALID_ADJUSTMENT_STATUSES))}.")
            return s
        raise ValueError("Adjustment status is required.")


class StockAdjustmentRead(BaseModel):
    id: int
    adjustment_date: str | None = None
    warehouse_name: str
    item_name: str
    old_qty: int = Field(0, ge=0)
    new_qty: int = Field(0, ge=0)
    difference: int = 0
    reason: str
    status: str
    approved_by: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_adjustment_status(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_ADJUSTMENT_STATUSES:
                raise ValueError(f"Invalid adjustment status '{v}'. Must be one of {', '.join(sorted(VALID_ADJUSTMENT_STATUSES))}.")
            return s
        return "pending"


class LedgerSummaryRead(BaseModel):
    total_transactions: int = Field(0, ge=0)
    stock_in: int = Field(0, ge=0)
    stock_out: int = Field(0, ge=0)
    transfers: int = Field(0, ge=0)
    adjustments: int = Field(0, ge=0)
    current_stock_value: float = Field(0.0, ge=0.0)


class LedgerEntryRead(BaseModel):
    id: int
    date: str | None = None
    transaction: str
    warehouse_name: str
    item_name: str
    batch_number: str | None = None
    qty_in: int = Field(0, ge=0)
    qty_out: int = Field(0, ge=0)
    balance: int = Field(0, ge=0)
    user_name: str | None = None
    reference: str | None = None


class InventoryHubRead(BaseModel):
    total_inventory_value: float = Field(0.0, ge=0.0)
    low_stock_items: int = Field(0, ge=0)
    dead_stock: int = Field(0, ge=0)
    fast_moving: int = Field(0, ge=0)
    slow_moving: int = Field(0, ge=0)
    todays_transactions: int = Field(0, ge=0)
    warehouse_stock: list[dict] = Field(default_factory=list)
    top_materials: list[dict] = Field(default_factory=list)


VALID_RETURN_STATUSES = {
    "draft",
    "pending_verification",
    "quality_check",
    "stock_update_pending",
    "completed",
    "rejected",
    "cancelled",
}

VALID_RETURN_TYPES = {
    "production_return",
    "purchase_return",
    "job_card_return",
    "excess_material_return",
    "damaged_material_return",
}

VALID_RETURN_CONDITIONS = {"good", "damaged", "reusable", "scrap"}


class StockReturnLineCreate(BaseModel):
    item_id: int = Field(..., ge=1)
    batch_number: str | None = None
    available_qty: int = Field(0, ge=0)
    return_qty: int = Field(..., ge=1)
    unit: str = Field("pcs", min_length=1, max_length=32)
    condition: str = Field("good", min_length=1, max_length=32)
    warehouse_id: int = Field(..., ge=1)
    line_reason: str | None = None

    @field_validator("condition", mode="before")
    @classmethod
    def validate_condition(cls, v: Any) -> str:
        s = str(v or "good").strip().lower()
        if s not in VALID_RETURN_CONDITIONS:
            raise ValueError(f"Invalid condition '{v}'.")
        return s


class StockReturnLineRead(BaseModel):
    id: int
    line_no: int
    item_id: int
    material_code: str
    material_name: str
    batch_number: str | None = None
    available_qty: int = Field(0, ge=0)
    return_qty: int = Field(0, ge=0)
    unit: str = "pcs"
    condition: str = "good"
    warehouse_id: int
    warehouse_name: str
    line_reason: str | None = None


class StockReturnCreate(BaseModel):
    return_number: str | None = None
    return_date: str | None = None
    return_type: str
    reference_no: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    department: str | None = None
    returned_by: str | None = None
    returned_by_user_id: int | None = None
    return_to_warehouse_id: int = Field(..., ge=1)
    reason: str | None = None
    remarks: str | None = None
    status: str = "draft"
    lines: list[StockReturnLineCreate] = Field(..., min_length=1)

    @field_validator("return_type", mode="before")
    @classmethod
    def validate_return_type(cls, v: Any) -> str:
        s = str(v or "").strip().lower().replace(" ", "_")
        aliases = {
            "production_return": "production_return",
            "purchase_return": "purchase_return",
            "job_card_return": "job_card_return",
            "excess_material_return": "excess_material_return",
            "damaged_material_return": "damaged_material_return",
        }
        if s in aliases:
            return aliases[s]
        if s not in VALID_RETURN_TYPES:
            raise ValueError(f"Invalid return_type '{v}'.")
        return s

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        s = str(v or "draft").strip().lower()
        if s not in VALID_RETURN_STATUSES:
            raise ValueError(f"Invalid status '{v}'.")
        return s

    @model_validator(mode="after")
    def validate_lines(self) -> "StockReturnCreate":
        for line in self.lines:
            if line.return_qty > line.available_qty and line.available_qty > 0:
                raise ValueError(
                    f"Return quantity ({line.return_qty}) cannot exceed available quantity ({line.available_qty})."
                )
        return self


class StockReturnUpdate(BaseModel):
    return_date: str | None = None
    return_type: str | None = None
    reference_no: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    department: str | None = None
    returned_by: str | None = None
    returned_by_user_id: int | None = None
    return_to_warehouse_id: int | None = Field(None, ge=1)
    reason: str | None = None
    remarks: str | None = None
    lines: list[StockReturnLineCreate] | None = None


class StockReturnStatusUpdate(BaseModel):
    status: str
    note: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        s = str(v or "").strip().lower()
        if s not in VALID_RETURN_STATUSES:
            raise ValueError(f"Invalid status '{v}'.")
        return s


class StockReturnSummaryRead(BaseModel):
    id: int
    return_number: str
    return_date: str | None = None
    reference_no: str | None = None
    return_type: str
    department: str | None = None
    returned_by: str | None = None
    total_qty: int = Field(0, ge=0)
    status: str
    created_at: str | None = None
    return_to_warehouse: str | None = None


class StockReturnRead(BaseModel):
    id: int
    return_number: str
    return_date: str | None = None
    return_type: str
    reference_no: str | None = None
    reference_type: str | None = None
    reference_id: int | None = None
    department: str | None = None
    returned_by: str | None = None
    returned_by_user_id: int | None = None
    return_to_warehouse_id: int
    return_to_warehouse: str
    reason: str | None = None
    remarks: str | None = None
    status: str
    total_qty: int = Field(0, ge=0)
    created_by: str | None = None
    verified_by: str | None = None
    quality_checked_by: str | None = None
    completed_by: str | None = None
    rejected_by: str | None = None
    rejection_reason: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    lines: list[StockReturnLineRead] = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)


VALID_STOCK_IN_STATUSES = {"draft", "pending", "confirmed", "cancelled"}

VALID_STOCK_IN_REFERENCE_TYPES = {
    "purchase_order",
    "purchase_receipt",
    "stock_return",
    "manual_entry",
    "other",
}


class StockInAttachment(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    size: int = Field(..., ge=0)
    mime_type: str | None = None
    data_base64: str | None = None


class StockInLineCreate(BaseModel):
    item_id: int = Field(..., ge=1)
    ordered_qty: int = Field(0, ge=0)
    received_qty: int = Field(..., ge=1)
    unit: str = Field("pcs", min_length=1, max_length=32)
    batch_number: str | None = None
    lot_number: str | None = None
    manufacturing_date: str | None = None
    expiry_date: str | None = None
    storage_location: str | None = None
    line_remarks: str | None = None


class StockInLineRead(BaseModel):
    id: int
    line_no: int
    item_id: int
    material_code: str
    material_name: str
    description: str | None = None
    ordered_qty: int = Field(0, ge=0)
    received_qty: int = Field(0, ge=0)
    unit: str = "pcs"
    batch_number: str | None = None
    lot_number: str | None = None
    manufacturing_date: str | None = None
    expiry_date: str | None = None
    storage_location: str | None = None
    line_remarks: str | None = None


class StockInCreate(BaseModel):
    stock_in_number: str | None = None
    stock_in_date: str | None = None
    reference_type: str
    reference_no: str | None = None
    reference_id: int | None = None
    supplier_id: int | None = Field(None, ge=1)
    supplier_name: str | None = None
    warehouse_id: int = Field(..., ge=1)
    storage_location: str | None = None
    received_by: str | None = None
    received_by_user_id: int | None = None
    remarks: str | None = None
    attachments: list[StockInAttachment] = Field(default_factory=list)
    status: str = "draft"
    lines: list[StockInLineCreate] = Field(..., min_length=1)

    @field_validator("reference_type", mode="before")
    @classmethod
    def validate_reference_type(cls, v: Any) -> str:
        s = str(v or "").strip().lower().replace(" ", "_")
        aliases = {
            "purchase_order": "purchase_order",
            "purchase_receipt": "purchase_receipt",
            "stock_return": "stock_return",
            "manual_entry": "manual_entry",
            "other": "other",
        }
        if s in aliases:
            return aliases[s]
        if s not in VALID_STOCK_IN_REFERENCE_TYPES:
            raise ValueError(f"Invalid reference_type '{v}'.")
        return s

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        s = str(v or "draft").strip().lower()
        if s not in VALID_STOCK_IN_STATUSES:
            raise ValueError(f"Invalid status '{v}'.")
        return s


class StockInUpdate(BaseModel):
    stock_in_date: str | None = None
    reference_type: str | None = None
    reference_no: str | None = None
    reference_id: int | None = None
    supplier_id: int | None = Field(None, ge=1)
    supplier_name: str | None = None
    warehouse_id: int | None = Field(None, ge=1)
    storage_location: str | None = None
    received_by: str | None = None
    received_by_user_id: int | None = None
    remarks: str | None = None
    attachments: list[StockInAttachment] | None = None
    lines: list[StockInLineCreate] | None = None


class StockInStatusUpdate(BaseModel):
    status: str
    note: str | None = None

    @field_validator("status", mode="before")
    @classmethod
    def validate_status(cls, v: Any) -> str:
        s = str(v or "").strip().lower()
        if s not in VALID_STOCK_IN_STATUSES:
            raise ValueError(f"Invalid status '{v}'.")
        return s


class StockInSummaryRead(BaseModel):
    id: int
    stock_in_number: str
    stock_in_date: str | None = None
    reference_type: str
    reference_no: str | None = None
    supplier_name: str | None = None
    warehouse_name: str | None = None
    received_by: str | None = None
    total_qty: int = Field(0, ge=0)
    status: str
    created_at: str | None = None


class StockInRead(BaseModel):
    id: int
    stock_in_number: str
    stock_in_date: str | None = None
    reference_type: str
    reference_no: str | None = None
    reference_id: int | None = None
    supplier_id: int | None = None
    supplier_name: str | None = None
    warehouse_id: int
    warehouse_name: str
    storage_location: str | None = None
    received_by: str | None = None
    received_by_user_id: int | None = None
    remarks: str | None = None
    attachments: list[StockInAttachment] = Field(default_factory=list)
    status: str
    total_qty: int = Field(0, ge=0)
    created_by: str | None = None
    updated_by: str | None = None
    confirmed_by: str | None = None
    confirmed_at: str | None = None
    created_at: str | None = None
    updated_at: str | None = None
    lines: list[StockInLineRead] = Field(default_factory=list)
    summary: dict = Field(default_factory=dict)



