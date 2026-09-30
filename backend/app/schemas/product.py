from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


class ProductBase(BaseModel):
    tenant_id: int
    sku: str | None = Field(default=None, max_length=64)
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(default="Finished Goods", max_length=128)
    unit_cost: float | None = Field(None, ge=0)
    unit_price: float | None = Field(None, ge=0)
    wholesale_price: float | None = Field(None, ge=0)
    min_stock: int | None = Field(None, ge=0)
    max_stock: int | None = Field(None, ge=0)
    current_stock: float | None = Field(None, ge=0)
    unit: str | None = Field("Pcs", max_length=32)
    hsn_code: str | None = Field(None, max_length=32)
    gst_percent: float | None = Field(None, ge=0, le=100.0)
    cess_percent: float | None = Field(None, ge=0, le=100.0)
    status: str = Field("active", pattern="^(active|inactive)$")
    is_sellable: bool = False

    @field_validator("gst_percent", "cess_percent", mode="before")
    @classmethod
    def validate_tax_percent_range(cls, v: float | int | str | None, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name_not_empty_or_whitespace(cls, v: str) -> str:
        if isinstance(v, str):
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Product name cannot be blank or contain only spaces")
            import re
            if not re.search(r"[a-zA-Z0-9]", v_trimmed):
                raise ValueError("Product Name must contain at least one letter or number and cannot consist only of special characters")
            return v_trimmed
        return v

    @field_validator("unit_cost", mode="before")
    @classmethod
    def validate_unit_cost_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Purchase Price cannot be negative.")
            return val
        return None

    @field_validator("unit_price", "wholesale_price", mode="before")
    @classmethod
    def validate_prices_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Price cannot be negative.")
            return val
        return None

    @field_validator("current_stock", mode="before")
    @classmethod
    def validate_current_stock_not_negative(cls, v: float | int | str | None) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Current Stock cannot be negative.")
            return val
        return None

    @field_validator("min_stock", mode="before")
    @classmethod
    def validate_min_stock_not_negative(cls, v: float | int | str | None) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Min Stock cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_stock_range(self) -> "ProductBase":
        if self.min_stock is not None and self.max_stock is not None:
            if self.max_stock < self.min_stock:
                raise ValueError("max_stock cannot be less than min_stock.")
        return self


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    sku: str | None = Field(None, max_length=64)
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    category: str | None = Field(None, max_length=128)
    unit_cost: float | None = Field(None, ge=0)
    unit_price: float | None = Field(None, ge=0)
    wholesale_price: float | None = Field(None, ge=0)
    min_stock: int | None = Field(None, ge=0)
    max_stock: int | None = Field(None, ge=0)
    current_stock: float | None = Field(None, ge=0)
    unit: str | None = Field(None, max_length=32)
    hsn_code: str | None = Field(None, max_length=32)
    gst_percent: float | None = Field(None, ge=0, le=100.0)
    cess_percent: float | None = Field(None, ge=0, le=100.0)
    status: str | None = Field(None, pattern="^(active|inactive)$")
    is_sellable: bool | None = None

    @field_validator("gst_percent", "cess_percent", mode="before")
    @classmethod
    def validate_tax_percent_range(cls, v: float | int | str | None, info: Any) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0 or val > 100:
                raise ValueError(f"{info.field_name} must be between 0 and 100.")
            return val
        return None

    @field_validator("name", mode="before")
    @classmethod
    def validate_name_not_empty_or_whitespace(cls, v: str | None) -> str | None:
        if v is not None and isinstance(v, str):
            v_trimmed = v.strip()
            if not v_trimmed:
                raise ValueError("Product name cannot be blank or contain only spaces")
            import re
            if not re.search(r"[a-zA-Z0-9]", v_trimmed):
                raise ValueError("Product Name must contain at least one letter or number and cannot consist only of special characters")
            return v_trimmed
        return v

    @field_validator("unit_cost", mode="before")
    @classmethod
    def validate_unit_cost_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Purchase Price cannot be negative.")
            return val
        return None

    @field_validator("unit_price", "wholesale_price", mode="before")
    @classmethod
    def validate_prices_not_negative(cls, v: float | int | str | None) -> float | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Price cannot be negative.")
            return val
        return None

    @field_validator("current_stock", mode="before")
    @classmethod
    def validate_current_stock_not_negative(cls, v: float | int | str | None) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Current Stock cannot be negative.")
            return val
        return None

    @field_validator("min_stock", mode="before")
    @classmethod
    def validate_min_stock_not_negative(cls, v: float | int | str | None) -> float | int | None:
        if v is not None and v != "":
            val = float(v)
            if val < 0:
                raise ValueError("Min Stock cannot be negative.")
            return val
        return None

    @model_validator(mode="after")
    def validate_stock_range(self) -> "ProductUpdate":
        if self.min_stock is not None and self.max_stock is not None:
            if self.max_stock < self.min_stock:
                raise ValueError("max_stock cannot be less than min_stock.")
        return self


class ProductDetailRead(ProductBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class BomItemBase(BaseModel):
    tenant_id: int
    product_id: int
    component_product_id: int
    quantity: float
    unit: str = Field(..., min_length=1, max_length=32)


class BomItemCreate(BomItemBase):
    pass


class BomItemRead(BomItemBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
