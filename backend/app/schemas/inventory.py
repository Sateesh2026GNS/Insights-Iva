from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class WarehouseBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    name: str = Field(..., min_length=1)
    code: str = Field(..., min_length=1)
    capacity: int | None = Field(None, ge=0)
    is_primary: bool = False


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseRead(WarehouseBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class SupplierBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    name: str = Field(..., min_length=1)
    contact: str | None = None
    email: str | None = None
    phone: str | None = None
    outstanding: float | None = Field(0.0, ge=0.0)
    approval_status: str = "approved"


class SupplierCreate(SupplierBase):
    pass


class SupplierRead(SupplierBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class InventoryItemBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    supplier_id: int | None = Field(None, ge=1)
    sku: str = Field(..., min_length=1)
    barcode: str | None = None
    name: str = Field(..., min_length=1)
    description: str | None = None
    unit: str = "pcs"
    unit_cost: float | None = Field(None, ge=0.0)
    reorder_level: int = Field(0, ge=0)
    item_type: str = "raw_material"  # raw_material, finished_good
    category: str | None = None
    warehouse_name: str | None = None
    batch_number: str | None = None
    quantity: int | None = Field(0, ge=0)
    reserved: int | None = Field(0, ge=0)
    status: str | None = "in_stock"
    customer_name: str | None = None
    serial_number: str | None = None
    expiry_date: str | None = None
    production_date: str | None = None
    warranty: str | None = None
    is_active: bool = True
    created_at: datetime | None = None
    date: str | None = None

    @field_validator("unit_cost", mode="before")
    @classmethod
    def validate_unit_cost_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Purchase Price cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_reserved_not_exceed_total(self) -> "InventoryItemBase":
        qty = self.quantity if self.quantity is not None else 0
        res = self.reserved if self.reserved is not None else 0
        if res > qty:
            raise ValueError("Reserved quantity cannot exceed total quantity.")
        return self


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    supplier_id: int | None = Field(None, ge=1)
    sku: str | None = Field(None, min_length=1)
    barcode: str | None = None
    name: str | None = Field(None, min_length=1)
    description: str | None = None
    unit: str | None = None
    unit_cost: float | None = Field(None, ge=0.0)
    reorder_level: int | None = Field(None, ge=0)
    item_type: str | None = None
    category: str | None = None
    warehouse_name: str | None = None
    batch_number: str | None = None
    quantity: int | None = Field(None, ge=0)
    reserved: int | None = Field(None, ge=0)
    status: str | None = None
    customer_name: str | None = None
    serial_number: str | None = None
    expiry_date: str | None = None
    production_date: str | None = None
    warranty: str | None = None
    is_active: bool | None = None

    @field_validator("unit_cost", mode="before")
    @classmethod
    def validate_unit_cost_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Purchase Price cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_reserved_not_exceed_total(self) -> "InventoryItemUpdate":
        if self.quantity is not None and self.reserved is not None:
            if self.reserved > self.quantity:
                raise ValueError("Reserved quantity cannot exceed total quantity.")
        return self


class InventoryItemRead(InventoryItemBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class StockLevelBase(BaseModel):
    warehouse_id: int = Field(..., ge=1)
    item_id: int = Field(..., ge=1)
    quantity: int = Field(0, ge=0)


class StockLevelCreate(StockLevelBase):
    pass


class StockLevelRead(StockLevelBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


VALID_MOVEMENT_TYPES = {"in", "out", "adjustment", "return", "scrap", "transfer"}


class StockMovementBase(BaseModel):
    tenant_id: int = Field(..., ge=1)
    warehouse_id: int = Field(..., ge=1)
    item_id: int = Field(..., ge=1)
    quantity: int = Field(..., ge=1)
    movement_type: str  # in, out, adjustment, return, scrap, transfer
    reference: str | None = None
    batch_number: str | None = None
    created_by: str | None = None

    @field_validator("movement_type", mode="before")
    @classmethod
    def validate_movement_type(cls, v: Any) -> str:
        if v is not None:
            s = str(v).strip().lower()
            if s not in VALID_MOVEMENT_TYPES:
                raise ValueError(f"Invalid movement type '{v}'. Must be one of {', '.join(sorted(VALID_MOVEMENT_TYPES))}.")
            return s
        raise ValueError("movement_type is required.")


class StockMovementCreate(StockMovementBase):
    pass


class StockMovementRead(StockMovementBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
