from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator


def _dec(v) -> Decimal:
    if v is None:
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    return Decimal(str(v))


class ProductVendorPricingPayload(BaseModel):
    """Nested vendor pricing on product create/update."""

    id: int | None = None
    supplier_id: int
    purchase_price: Decimal = Field(default=Decimal("0"), ge=0)
    transport_cost: Decimal = Field(default=Decimal("0"), ge=0)
    labour_cost: Decimal = Field(default=Decimal("0"), ge=0)
    import_cost: Decimal = Field(default=Decimal("0"), ge=0)
    minimum_price: Decimal = Field(default=Decimal("0"), ge=0)
    maximum_price: Decimal = Field(default=Decimal("0"), ge=0)
    selling_price: Decimal = Field(default=Decimal("0"), ge=0)
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


class ProductVendorPricingRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    product_id: int
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
    vendor_name: str | None = None
    vendor_code: str | None = None
