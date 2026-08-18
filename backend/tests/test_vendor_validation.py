import pytest
from pydantic import ValidationError

from app.schemas.vendor import VendorBase, VendorBulkStatusUpdate, VendorCreate, VendorUpdate


def _valid_vendor_kwargs():
    return {
        "tenant_id": 1,
        "name": "Acme Industrial Supplies",
        "contact": "John Doe",
        "email": "john@acme.com",
        "phone": "9876543210",
    }


def test_vendor_create_valid_ratings_scores_percentages():
    vendor = VendorCreate(
        **_valid_vendor_kwargs(),
        rating=4.5,
        quality_score=95.0,
        delivery_score=90.0,
        price_score=88.5,
        service_score=92.0,
        on_time_delivery_percentage=98.0,
        rejection_percentage=1.5,
        credit_limit=500000.0,
        credit_days=30,
        lead_time_days=7,
        minimum_order_quantity=100.0,
        minimum_order_value=10000.0,
        product_ids=[1, 2, 3],
    )
    assert vendor.rating == 4.5
    assert vendor.quality_score == 95.0
    assert vendor.rejection_percentage == 1.5
    assert vendor.product_ids == [1, 2, 3]


def test_vendor_create_negative_rating_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), rating=-1.0)
    assert any(err["loc"] == ("rating",) for err in exc_info.value.errors())


def test_vendor_create_over_limit_rating_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), rating=5.5)
    assert any(err["loc"] == ("rating",) for err in exc_info.value.errors())


def test_vendor_create_invalid_quality_score_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), quality_score=150.0)
    assert any(err["loc"] == ("quality_score",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), quality_score=-5.0)
    assert any(err["loc"] == ("quality_score",) for err in exc_info.value.errors())


def test_vendor_create_invalid_rejection_percentage_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), rejection_percentage=-20.0)
    assert any(err["loc"] == ("rejection_percentage",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), rejection_percentage=105.0)
    assert any(err["loc"] == ("rejection_percentage",) for err in exc_info.value.errors())


def test_vendor_create_invalid_on_time_delivery_percentage_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), on_time_delivery_percentage=-1.0)
    assert any(err["loc"] == ("on_time_delivery_percentage",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), on_time_delivery_percentage=120.0)
    assert any(err["loc"] == ("on_time_delivery_percentage",) for err in exc_info.value.errors())


def test_vendor_create_invalid_product_ids_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), product_ids=[0])
    assert any(err["loc"] == ("product_ids",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), product_ids=[1, -2])
    assert any(err["loc"] == ("product_ids",) for err in exc_info.value.errors())


def test_vendor_update_invalid_scores_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(rating=-1.0)
    assert any(err["loc"] == ("rating",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(quality_score=150.0)
    assert any(err["loc"] == ("quality_score",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(rejection_percentage=-20.0)
    assert any(err["loc"] == ("rejection_percentage",) for err in exc_info.value.errors())


def test_vendor_update_valid_scores():
    update = VendorUpdate(
        rating=5.0,
        quality_score=100.0,
        rejection_percentage=0.0,
        delivery_score=85.0,
        price_score=90.0,
        service_score=95.0,
        on_time_delivery_percentage=100.0,
        product_ids=[10, 20],
    )
    assert update.rating == 5.0
    assert update.quality_score == 100.0
    assert update.rejection_percentage == 0.0
    assert update.product_ids == [10, 20]


def test_vendor_create_negative_financial_and_quantity_fields_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), credit_limit=-10000.0)
    assert any(err["loc"] == ("credit_limit",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), credit_days=-5)
    assert any(err["loc"] == ("credit_days",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), minimum_order_quantity=-10.0)
    assert any(err["loc"] == ("minimum_order_quantity",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), minimum_order_value=-500.0)
    assert any(err["loc"] == ("minimum_order_value",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorCreate(**_valid_vendor_kwargs(), lead_time_days=-1)
    assert any(err["loc"] == ("lead_time_days",) for err in exc_info.value.errors())


def test_vendor_update_negative_financial_and_quantity_fields_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(credit_limit=-10000.0)
    assert any(err["loc"] == ("credit_limit",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(credit_days=-5)
    assert any(err["loc"] == ("credit_days",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(minimum_order_quantity=-10.0)
    assert any(err["loc"] == ("minimum_order_quantity",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(minimum_order_value=-500.0)
    assert any(err["loc"] == ("minimum_order_value",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorUpdate(lead_time_days=-1)
    assert any(err["loc"] == ("lead_time_days",) for err in exc_info.value.errors())


def test_vendor_bulk_status_update_valid():
    bulk = VendorBulkStatusUpdate(vendor_ids=[1, 2, 3], status="active")
    assert bulk.vendor_ids == [1, 2, 3]
    assert bulk.status == "active"


def test_vendor_bulk_status_update_invalid_ids_rejected():
    with pytest.raises(ValidationError) as exc_info:
        VendorBulkStatusUpdate(vendor_ids=[0, -1], status="active")
    assert any(err["loc"] == ("vendor_ids",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorBulkStatusUpdate(vendor_ids=[10, 0], status="active")
    assert any(err["loc"] == ("vendor_ids",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        VendorBulkStatusUpdate(vendor_ids=[-5], status="inactive")
    assert any(err["loc"] == ("vendor_ids",) for err in exc_info.value.errors())
