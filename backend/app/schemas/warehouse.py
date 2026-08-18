from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class WarehouseExtendedBase(BaseModel):
    tenant_id: int
    name: str
    code: str
    capacity: int | None = Field(default=None, ge=0)
    used_capacity: int | None = Field(default=0, ge=0)
    is_primary: bool = False
    status: str = "active"
    warehouse_type: str | None = None
    branch: str | None = None
    plant: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    manager_name: str | None = None
    manager_phone: str | None = None
    rack_count: int | None = Field(default=None, ge=0)
    bin_count: int | None = Field(default=None, ge=0)


class WarehouseCreateExtended(WarehouseExtendedBase):
    pass


class WarehouseUpdate(BaseModel):
    name: str | None = None
    code: str | None = None
    capacity: int | None = Field(default=None, ge=0)
    used_capacity: int | None = Field(default=None, ge=0)
    is_primary: bool | None = None
    status: str | None = None
    warehouse_type: str | None = None
    branch: str | None = None
    plant: str | None = None
    address: str | None = None
    city: str | None = None
    state: str | None = None
    pincode: str | None = None
    manager_name: str | None = None
    manager_phone: str | None = None
    rack_count: int | None = Field(default=None, ge=0)
    bin_count: int | None = Field(default=None, ge=0)


class WarehouseListRead(WarehouseExtendedBase):
    id: int
    used_capacity: int = 0
    available_capacity: int | None = None
    utilization_pct: float | None = None
    inventory_value: float = 0
    item_count: int = 0
    low_stock_items: int = 0
    created_at: datetime | None = None
    model_config = ConfigDict(from_attributes=True)


class WarehouseSummaryRead(BaseModel):
    total_warehouses: int = 0
    active_warehouses: int = 0
    primary_warehouse: str | None = None
    storage_utilization_pct: float = 0
    total_inventory_value: float = 0
    low_stock_warehouses: int = 0
    pending_transfers: int = 0


class WarehouseStockItemRead(BaseModel):
    item_id: int
    sku: str
    name: str
    item_type: str
    quantity: int
    unit_cost: float | None = None
    stock_value: float = 0
    below_reorder: bool = False


class WarehouseMovementRead(BaseModel):
    id: int
    item_name: str
    quantity: int
    movement_type: str
    date: str | None = None


class WarehouseBinNode(BaseModel):
    name: str
    type: str
    children: list["WarehouseBinNode"] = Field(default_factory=list)


class WarehouseDetailRead(WarehouseListRead):
    raw_materials: int = 0
    finished_goods: int = 0
    wip_items: int = 0
    total_items: int = 0
    low_stock: int = 0
    out_of_stock: int = 0
    overstock: int = 0
    stock_items: list[WarehouseStockItemRead] = Field(default_factory=list)
    recent_movements: list[WarehouseMovementRead] = Field(default_factory=list)
    daily_inward: int = 0
    daily_outward: int = 0
    fast_moving: int = 0
    slow_moving: int = 0
    dead_stock: int = 0
    stock_turnover: float = 0
    bin_tree: list[WarehouseBinNode] = Field(default_factory=list)
