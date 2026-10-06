"""Product vendor pricing on masters products."""

from decimal import Decimal

import pytest

from app.schemas.product_vendor_pricing import ProductVendorPricingPayload


def test_pricing_payload_validates_selling_band():
    ProductVendorPricingPayload(
        supplier_id=1,
        purchase_price=Decimal("100"),
        minimum_price=Decimal("115"),
        maximum_price=Decimal("140"),
        selling_price=Decimal("125"),
    )


def test_pricing_payload_rejects_selling_above_max():
    with pytest.raises(ValueError):
        ProductVendorPricingPayload(
            supplier_id=1,
            minimum_price=Decimal("115"),
            maximum_price=Decimal("140"),
            selling_price=Decimal("150"),
        )
