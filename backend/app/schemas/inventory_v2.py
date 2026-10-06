from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class InventoryItemV2Base(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    sku: str | None = Field(None, max_length=64)
    barcode: str | None = Field(None, max_length=128)
    description: str | None = None
    unit: str | None = Field("Pcs", max_length=32)
    hsn_code: str | None = Field(None, max_length=32)
    category: str | None = Field(None, max_length=128)
    purchase_price: float | None = Field(None, ge=0)
    selling_price: float | None = Field(None, ge=0)
    wholesale_price: float | None = Field(None, ge=0)
    gst_percent: float | None = Field(0, ge=0, le=100.0)
    cess_percent: float | None = Field(0, ge=0, le=100.0)
    min_stock: float | None = Field(0, ge=0)
    max_stock: float | None = Field(None, ge=0)
    current_stock: float | None = Field(0, ge=0)

    @field_validator("gst_percent", "cess_percent", mode="before")
    @classmethod
    def validate_tax_percent_range(cls, v: float | int | str | None, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("purchase_price", mode="before")
    @classmethod
    def validate_purchase_price_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Purchase Price cannot be negative.")
            return val
        return None

    @field_validator("current_stock", "min_stock", "max_stock", mode="before")
    @classmethod
    def validate_stock_not_negative(cls, v: float | int | str | None) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Current Stock cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_stock_range(self) -> "InventoryItemV2Base":
        if self.min_stock is not None and self.max_stock is not None:
            if self.max_stock < self.min_stock:
                raise ValueError("max_stock cannot be less than min_stock.")
        return self


class InventoryItemV2Create(InventoryItemV2Base):
    pass


class InventoryItemV2Update(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=255)
    sku: str | None = Field(None, max_length=64)
    barcode: str | None = Field(None, max_length=128)
    description: str | None = None
    unit: str | None = Field(None, max_length=32)
    hsn_code: str | None = Field(None, max_length=32)
    category: str | None = Field(None, max_length=128)
    purchase_price: float | None = Field(None, ge=0)
    selling_price: float | None = Field(None, ge=0)
    wholesale_price: float | None = Field(None, ge=0)
    gst_percent: float | None = Field(None, ge=0, le=100.0)
    cess_percent: float | None = Field(None, ge=0, le=100.0)
    min_stock: float | None = Field(None, ge=0)
    max_stock: float | None = Field(None, ge=0)
    current_stock: float | None = Field(None, ge=0)

    @field_validator("gst_percent", "cess_percent", mode="before")
    @classmethod
    def validate_tax_percent_range(cls, v: float | int | str | None, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("purchase_price", mode="before")
    @classmethod
    def validate_purchase_price_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Purchase Price cannot be negative.")
            return val
        return None

    @field_validator("current_stock", "min_stock", "max_stock", mode="before")
    @classmethod
    def validate_stock_not_negative(cls, v: float | int | str | None) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Current Stock cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_stock_range(self) -> "InventoryItemV2Update":
        if self.min_stock is not None and self.max_stock is not None:
            if self.max_stock < self.min_stock:
                raise ValueError("max_stock cannot be less than min_stock.")
        return self


class InventoryItemV2Read(BaseModel):
    id: int
    name: str
    sku: str | None = None
    product_code: str | None = None
    description: str | None = None
    unit: str | None = None
    hsn_code: str | None = None
    category: str | None = None
    purchase_price: float = 0
    selling_price: float = 0
    wholesale_price: float = 0
    gst_percent: float = 0
    cess_percent: float = 0
    min_stock: float = 0
    max_stock: float | None = None
    current_stock: float = 0
    stock_value: float = 0

    model_config = ConfigDict(from_attributes=True)


class StockAdjustRequest(BaseModel):
    quantity: float = Field(..., gt=0)
    unit: str | None = Field("PCS", max_length=32)
    remark: str | None = None


class StockAdjustResponse(BaseModel):
    product_id: int
    previous_stock: float
    current_stock: float
    change: float
    timeline_entry: dict


class StockTimelineEntry(BaseModel):
    id: int | str
    activity: str
    subtitle: str | None = None
    date: str | None = None
    change: float
    final: float
    unit: str | None = None


class InventoryCategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)


class InventoryCategoryRead(BaseModel):
    id: int
    name: str
    stock: int = 0

    model_config = ConfigDict(from_attributes=True)


class InventoryCategoryWiseRead(BaseModel):
    category: str
    stock: int
