from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _dec(v) -> Decimal:
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


class MaterialPricingBase(BaseModel):
    inventory_item_id: int
    supplier_id: int
    purchase_price: Decimal = Field(default=Decimal("0"), ge=0)
    transport_cost: Decimal = Field(default=Decimal("0"), ge=0)
    labour_cost: Decimal = Field(default=Decimal("0"), ge=0)
    import_cost: Decimal = Field(default=Decimal("0"), ge=0)
    minimum_price: Decimal = Field(default=Decimal("0"), ge=0)
    maximum_price: Decimal = Field(default=Decimal("0"), ge=0)
    selling_price: Decimal = Field(default=Decimal("0"), ge=0)
    currency: str = "INR"
    notes: str | None = None
    is_active: bool = True

    @model_validator(mode="after")
    def validate_price_band(self):
        if self.minimum_price > self.maximum_price and self.maximum_price > 0:
            raise ValueError("Minimum price cannot exceed maximum price.")
        if self.maximum_price > 0:
            if self.selling_price < self.minimum_price:
                raise ValueError("Company selling price must be at least the minimum price.")
            if self.selling_price > self.maximum_price:
                raise ValueError("Company selling price cannot exceed the maximum price.")
        return self


class MaterialPricingCreate(MaterialPricingBase):
    pass


class MaterialPricingUpdate(BaseModel):
    purchase_price: Decimal | None = Field(None, ge=0)
    transport_cost: Decimal | None = Field(None, ge=0)
    labour_cost: Decimal | None = Field(None, ge=0)
    import_cost: Decimal | None = Field(None, ge=0)
    minimum_price: Decimal | None = Field(None, ge=0)
    maximum_price: Decimal | None = Field(None, ge=0)
    selling_price: Decimal | None = Field(None, ge=0)
    currency: str | None = None
    notes: str | None = None
    is_active: bool | None = None

    @model_validator(mode="after")
    def validate_price_band(self):
        fields = {
            "minimum_price": self.minimum_price,
            "maximum_price": self.maximum_price,
            "selling_price": self.selling_price,
        }
        if all(v is None for v in fields.values()):
            return self
        min_p = _dec(self.minimum_price) if self.minimum_price is not None else None
        max_p = _dec(self.maximum_price) if self.maximum_price is not None else None
        sell = _dec(self.selling_price) if self.selling_price is not None else None
        if min_p is not None and max_p is not None and max_p > 0 and min_p > max_p:
            raise ValueError("Minimum price cannot exceed maximum price.")
        if sell is not None and min_p is not None and sell < min_p:
            raise ValueError("Company selling price must be at least the minimum price.")
        if sell is not None and max_p is not None and max_p > 0 and sell > max_p:
            raise ValueError("Company selling price cannot exceed the maximum price.")
        return self


class MaterialPricingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tenant_id: int
    inventory_item_id: int
    supplier_id: int
    purchase_price: Decimal
    transport_cost: Decimal
    labour_cost: Decimal
    import_cost: Decimal
    total_landed_cost: Decimal
    minimum_price: Decimal
    maximum_price: Decimal
    selling_price: Decimal
    currency: str
    notes: str | None
    is_active: bool
    created_by: str | None
    updated_by: str | None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    material_name: str | None = None
    material_sku: str | None = None
    material_category: str | None = None
    material_unit: str | None = None
    vendor_name: str | None = None
    margin_pct: Decimal | None = None

    @field_validator(
        "purchase_price",
        "transport_cost",
        "labour_cost",
        "import_cost",
        "total_landed_cost",
        "minimum_price",
        "maximum_price",
        "selling_price",
        mode="before",
    )
    @classmethod
    def coerce_decimal(cls, v):
        return _dec(v)


class MaterialPricingListResponse(BaseModel):
    items: list[MaterialPricingRead]
    total: int
    page: int
    page_size: int
    pages: int


class MaterialPricingDetailRead(MaterialPricingRead):
    material_description: str | None = None
    total_stock: int | None = None


class MaterialOptionRead(BaseModel):
    id: int
    name: str
    sku: str
    unit: str | None = None
    category: str | None = None


class VendorOptionRead(BaseModel):
    id: int
    name: str
    vendor_code: str | None = None
