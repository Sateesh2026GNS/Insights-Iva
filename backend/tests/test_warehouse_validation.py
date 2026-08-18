import pytest
from pydantic import ValidationError

from app.schemas.warehouse import (
    WarehouseCreateExtended,
    WarehouseExtendedBase,
    WarehouseUpdate,
)


def _valid_warehouse_kwargs():
    return {
        "tenant_id": 1,
        "name": "Central Storage Facility",
        "code": "WH-001",
    }


def test_warehouse_create_valid_capacity():
    wh = WarehouseCreateExtended(
        **_valid_warehouse_kwargs(),
        capacity=10000,
        used_capacity=2500,
        rack_count=20,
        bin_count=100,
    )
    assert wh.capacity == 10000
    assert wh.used_capacity == 2500
    assert wh.rack_count == 20
    assert wh.bin_count == 100


def test_warehouse_create_zero_capacity_allowed():
    wh = WarehouseCreateExtended(
        **_valid_warehouse_kwargs(),
        capacity=0,
        used_capacity=0,
    )
    assert wh.capacity == 0
    assert wh.used_capacity == 0


def test_warehouse_create_negative_capacity_rejected():
    with pytest.raises(ValidationError) as exc_info:
        WarehouseCreateExtended(**_valid_warehouse_kwargs(), capacity=-500)
    assert any(err["loc"] == ("capacity",) for err in exc_info.value.errors())


def test_warehouse_create_negative_used_capacity_rejected():
    with pytest.raises(ValidationError) as exc_info:
        WarehouseCreateExtended(**_valid_warehouse_kwargs(), used_capacity=-10)
    assert any(err["loc"] == ("used_capacity",) for err in exc_info.value.errors())


def test_warehouse_create_negative_rack_and_bin_count_rejected():
    with pytest.raises(ValidationError) as exc_info:
        WarehouseCreateExtended(**_valid_warehouse_kwargs(), rack_count=-1)
    assert any(err["loc"] == ("rack_count",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        WarehouseCreateExtended(**_valid_warehouse_kwargs(), bin_count=-5)
    assert any(err["loc"] == ("bin_count",) for err in exc_info.value.errors())


def test_warehouse_update_negative_capacity_rejected():
    with pytest.raises(ValidationError) as exc_info:
        WarehouseUpdate(capacity=-100)
    assert any(err["loc"] == ("capacity",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        WarehouseUpdate(used_capacity=-50)
    assert any(err["loc"] == ("used_capacity",) for err in exc_info.value.errors())


def test_warehouse_update_valid_capacity():
    update = WarehouseUpdate(capacity=5000, used_capacity=1200, rack_count=10, bin_count=50)
    assert update.capacity == 5000
    assert update.used_capacity == 1200
    assert update.rack_count == 10
    assert update.bin_count == 50


def test_warehouse_update_negative_rack_and_bin_count_rejected():
    with pytest.raises(ValidationError) as exc_info:
        WarehouseUpdate(rack_count=-5)
    assert any(err["loc"] == ("rack_count",) for err in exc_info.value.errors())

    with pytest.raises(ValidationError) as exc_info:
        WarehouseUpdate(bin_count=-10)
    assert any(err["loc"] == ("bin_count",) for err in exc_info.value.errors())

