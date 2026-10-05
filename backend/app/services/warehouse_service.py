"""Warehouse master — enriched list, summary, detail, and updates."""

from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, aliased

from app.models.file_storage import FileAttachment, StoredFile
from app.models.inventory import (
    InventoryItem,
    StockLevel,
    StockMovement,
    StockTransfer,
    StoreIssueRequest,
    Warehouse,
)
from app.models.procurement import GoodsReceipt
from app.models.sales import Customer, DispatchShipment, SalesOrder
from app.models.security import AccessLog, AuditLog
from app.models.user import User
from app.schemas.warehouse import (
    WarehouseCreateExtended,
    WarehouseDetailRead,
    WarehouseListRead,
    WarehouseMovementRead,
    WarehouseStockItemRead,
    WarehouseSummaryRead,
    WarehouseUpdate,
)


def _warehouse_stats(db: Session, warehouse_id: int, tenant_id: int | None = None) -> dict:
    max_stock_col = getattr(InventoryItem, "max_stock", None)
    if max_stock_col is None:
        max_stock_col = getattr(InventoryItem, "max_level", None)

    select_cols = [
        StockLevel.quantity,
        InventoryItem.unit_cost,
        InventoryItem.reorder_level,
        InventoryItem.item_type,
        InventoryItem.id,
    ]
    if max_stock_col is not None:
        select_cols.append(max_stock_col)

    stmt = (
        select(*select_cols)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .where(StockLevel.warehouse_id == warehouse_id)
    )
    if tenant_id is not None:
        stmt = stmt.where(InventoryItem.tenant_id == tenant_id)
    else:
        wh = db.get(Warehouse, warehouse_id)
        if wh:
            stmt = stmt.where(InventoryItem.tenant_id == wh.tenant_id)

    rows = db.execute(stmt).all()

    used = 0
    value = 0.0
    item_count = 0
    low_stock = 0
    out_of_stock = 0
    overstock = 0
    raw = finished = wip = 0

    for row in rows:
        sl_qty, unit_cost, reorder, item_type, _item_id = row[:5]
        max_val = row[6] if len(row) > 6 else None
        q = int(sl_qty or 0)
        used += q
        item_count += 1
        cost = float(unit_cost or 0)
        value += q * cost

        r = int(reorder or 0)
        if q <= 0:
            out_of_stock += 1
            low_stock += 1
        elif r > 0 and q <= r:
            low_stock += 1

        limit = None
        if max_val is not None and int(max_val) > 0:
            limit = int(max_val)
        elif r > 0:
            limit = r * 3

        if limit is not None and q > limit:
            overstock += 1

        if item_type == "raw_material":
            raw += 1
        elif item_type == "finished_good":
            finished += 1
        else:
            wip += 1

    return {
        "used_capacity": used,
        "inventory_value": round(value, 2),
        "item_count": item_count,
        "low_stock_items": low_stock,
        "out_of_stock": out_of_stock,
        "overstock": overstock,
        "raw_materials": raw,
        "finished_goods": finished,
        "wip_items": wip,
    }


def _to_list_read(db: Session, wh: Warehouse) -> WarehouseListRead:
    stats = _warehouse_stats(db, wh.id, tenant_id=wh.tenant_id)
    wh_used = getattr(wh, "used_capacity", 0) or 0
    used_cap = max(stats["used_capacity"], wh_used)
    available = (wh.capacity - used_cap) if wh.capacity is not None else None
    util = (
        round(used_cap / wh.capacity * 100, 1)
        if wh.capacity and wh.capacity > 0
        else None
    )
    data = WarehouseListRead.model_validate(wh)
    data.used_capacity = used_cap
    data.available_capacity = available
    data.utilization_pct = util
    data.inventory_value = stats["inventory_value"]
    data.item_count = stats["item_count"]
    data.low_stock_items = stats["low_stock_items"]
    return data


def list_warehouses_enriched(db: Session, tenant_id: int) -> list[WarehouseListRead]:
    warehouses = list(
        db.scalars(
            select(Warehouse)
            .where(Warehouse.tenant_id == tenant_id)
            .order_by(Warehouse.name)
        ).all()
    )
    return [_to_list_read(db, wh) for wh in warehouses]


def get_warehouse_summary(db: Session, tenant_id: int) -> WarehouseSummaryRead:
    warehouses = list(
        db.scalars(select(Warehouse).where(Warehouse.tenant_id == tenant_id)).all()
    )
    if not warehouses:
        return WarehouseSummaryRead()

    active = sum(1 for w in warehouses if w.status == "active")
    primary = next((w.name for w in warehouses if w.is_primary), None)
    total_value = 0.0
    total_used = 0
    total_capacity = 0
    low_stock_wh = 0

    for wh in warehouses:
        stats = _warehouse_stats(db, wh.id, tenant_id=tenant_id)
        total_value += stats["inventory_value"]
        total_used += stats["used_capacity"]
        if wh.capacity:
            total_capacity += wh.capacity
        avail = (wh.capacity - stats["used_capacity"]) if wh.capacity else None
        if stats["low_stock_items"] > 0 or stats["out_of_stock"] > 0 or (avail is not None and avail <= 0):
            low_stock_wh += 1


    util_pct = round(total_used / total_capacity * 100, 1) if total_capacity else 0

    pending = db.scalar(
        select(func.count(StockMovement.id)).where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.movement_type == "out",
        )
    ) or 0
    pending = min(int(pending), 20)

    return WarehouseSummaryRead(
        total_warehouses=len(warehouses),
        active_warehouses=active,
        primary_warehouse=primary,
        storage_utilization_pct=util_pct,
        total_inventory_value=round(total_value, 2),
        low_stock_warehouses=low_stock_wh,
        pending_transfers=pending,
    )



def get_warehouse_detail(
    db: Session, tenant_id: int, warehouse_id: int
) -> WarehouseDetailRead | None:
    wh = db.scalars(
        select(Warehouse).where(
            Warehouse.id == warehouse_id, Warehouse.tenant_id == tenant_id
        )
    ).first()
    if not wh:
        return None

    stats = _warehouse_stats(db, wh.id, tenant_id=tenant_id)
    detail = WarehouseDetailRead.model_validate(_to_list_read(db, wh))
    detail.raw_materials = stats["raw_materials"]
    detail.finished_goods = stats["finished_goods"]
    detail.wip_items = stats["wip_items"]
    detail.total_items = stats["item_count"]
    detail.low_stock = stats["low_stock_items"]
    detail.out_of_stock = stats["out_of_stock"]
    detail.overstock = stats["overstock"]

    stock_rows = db.execute(
        select(
            InventoryItem.id,
            InventoryItem.sku,
            InventoryItem.name,
            InventoryItem.item_type,
            StockLevel.quantity,
            InventoryItem.unit_cost,
            InventoryItem.reorder_level,
        )
        .join(StockLevel, StockLevel.item_id == InventoryItem.id)
        .where(
            StockLevel.warehouse_id == warehouse_id,
            InventoryItem.tenant_id == tenant_id,
        )
        .order_by(InventoryItem.name)
    ).all()

    detail.stock_items = [
        WarehouseStockItemRead(
            item_id=r[0],
            sku=r[1],
            name=r[2],
            item_type=r[3],
            quantity=float(r[4] or 0),
            unit_cost=float(r[5]) if r[5] else None,
            stock_value=round(float(r[4] or 0) * float(r[5] or 0), 2),
            below_reorder=bool(int(r[6] or 0) > 0 and float(r[4] or 0) <= int(r[6] or 0)),
        )
        for r in stock_rows
    ]

    today = datetime.now(timezone.utc).date()
    movements = db.execute(
        select(
            StockMovement.id,
            InventoryItem.name,
            StockMovement.quantity,
            StockMovement.movement_type,
            StockMovement.created_at,
        )
        .join(InventoryItem, StockMovement.item_id == InventoryItem.id)
        .where(
            StockMovement.tenant_id == tenant_id,
            StockMovement.warehouse_id == warehouse_id,
            InventoryItem.tenant_id == tenant_id,
        )
        .order_by(StockMovement.created_at.desc())
        .limit(30)
    ).all()

    detail.recent_movements = [
        WarehouseMovementRead(
            id=r[0],
            item_name=r[1],
            quantity=float(r[2] or 0),
            movement_type=r[3],
            date=r[4].isoformat() if r[4] else None,
        )
        for r in movements
    ]

    from_warehouse = aliased(Warehouse)
    to_warehouse = aliased(Warehouse)
    transfer_rows = db.execute(
        select(
            StockTransfer.id,
            StockTransfer.transfer_number,
            StockTransfer.transfer_date,
            from_warehouse.name,
            to_warehouse.name,
            InventoryItem.name,
            StockTransfer.quantity,
            StockTransfer.status,
            StockTransfer.from_warehouse_id,
        )
        .join(InventoryItem, InventoryItem.id == StockTransfer.item_id)
        .join(from_warehouse, from_warehouse.id == StockTransfer.from_warehouse_id)
        .join(to_warehouse, to_warehouse.id == StockTransfer.to_warehouse_id)
        .where(
            StockTransfer.tenant_id == tenant_id,
            (StockTransfer.from_warehouse_id == warehouse_id)
            | (StockTransfer.to_warehouse_id == warehouse_id),
        )
        .order_by(StockTransfer.id.desc())
        .limit(50)
    ).all()
    detail.transfers = [
        {
            "id": r[0],
            "reference": r[1],
            "date": r[2].isoformat() if r[2] else None,
            "from_warehouse": r[3],
            "to_warehouse": r[4],
            "item": r[5],
            "quantity": int(r[6] or 0),
            "status": r[7],
            "direction": "outgoing" if r[8] == warehouse_id else "incoming",
        }
        for r in transfer_rows
    ]

    receipt_rows = db.execute(
        select(
            GoodsReceipt.id,
            GoodsReceipt.grn_number,
            GoodsReceipt.receipt_date,
            GoodsReceipt.status,
            GoodsReceipt.qc_status,
            GoodsReceipt.received_by,
        )
        .where(
            GoodsReceipt.tenant_id == tenant_id,
            GoodsReceipt.warehouse_id == warehouse_id,
        )
        .order_by(GoodsReceipt.receipt_date.desc(), GoodsReceipt.id.desc())
        .limit(50)
    ).all()
    detail.purchase_receipts = [
        {
            "id": r[0],
            "reference": r[1],
            "date": r[2].isoformat() if r[2] else None,
            "status": r[3],
            "qc_status": r[4],
            "received_by": r[5],
        }
        for r in receipt_rows
    ]

    production_rows = db.execute(
        select(
            StoreIssueRequest.id,
            StoreIssueRequest.request_number,
            StoreIssueRequest.status,
            StoreIssueRequest.operator_name,
            StoreIssueRequest.issued_qty,
            StoreIssueRequest.quantity,
            InventoryItem.name,
            StoreIssueRequest.created_at,
        )
        .join(InventoryItem, InventoryItem.id == StoreIssueRequest.item_id)
        .where(
            StoreIssueRequest.tenant_id == tenant_id,
            StoreIssueRequest.warehouse_id == warehouse_id,
            InventoryItem.tenant_id == tenant_id,
        )
        .order_by(StoreIssueRequest.created_at.desc())
        .limit(50)
    ).all()
    detail.production_issues = [
        {
            "id": r[0],
            "reference": r[1],
            "status": r[2],
            "requested_by": r[3],
            "quantity": int(r[4] if r[4] is not None else r[5] or 0),
            "item": r[6],
            "date": r[7].isoformat() if r[7] else None,
        }
        for r in production_rows
    ]

    dispatch_rows = db.execute(
        select(
            DispatchShipment.id,
            DispatchShipment.dispatch_number,
            DispatchShipment.dispatch_date,
            DispatchShipment.status,
            Customer.name,
            DispatchShipment.courier,
            DispatchShipment.vehicle_number,
        )
        .join(SalesOrder, SalesOrder.id == DispatchShipment.sales_order_id)
        .join(Customer, Customer.id == DispatchShipment.customer_id)
        .where(
            DispatchShipment.tenant_id == tenant_id,
            SalesOrder.tenant_id == tenant_id,
            SalesOrder.warehouse_id == warehouse_id,
        )
        .order_by(DispatchShipment.dispatch_date.desc(), DispatchShipment.id.desc())
        .limit(50)
    ).all()
    detail.dispatches = [
        {
            "id": r[0],
            "reference": r[1],
            "date": r[2].isoformat() if r[2] else None,
            "status": r[3],
            "customer": r[4],
            "courier": r[5],
            "vehicle": r[6],
        }
        for r in dispatch_rows
    ]

    document_rows = db.execute(
        select(
            StoredFile.id,
            StoredFile.original_filename,
            StoredFile.mime_type,
            StoredFile.file_size,
            StoredFile.upload_status,
            FileAttachment.label,
            FileAttachment.created_at,
        )
        .join(FileAttachment, FileAttachment.file_id == StoredFile.id)
        .where(
            FileAttachment.tenant_id == tenant_id,
            FileAttachment.entity_type.in_(
                ("warehouse", "Warehouse", "warehouses", "Warehouses")
            ),
            FileAttachment.entity_id == warehouse_id,
            StoredFile.tenant_id == tenant_id,
            StoredFile.deleted_at.is_(None),
        )
        .order_by(FileAttachment.created_at.desc())
        .limit(50)
    ).all()
    detail.documents = [
        {
            "id": r[0],
            "filename": r[1],
            "mime_type": r[2],
            "file_size": int(r[3] or 0),
            "status": r[4],
            "label": r[5],
            "date": r[6].isoformat() if r[6] else None,
        }
        for r in document_rows
    ]

    audit_rows = db.execute(
        select(
            AccessLog.id,
            AccessLog.action,
            AccessLog.full_name,
            AccessLog.email,
            AccessLog.logged_at,
            AccessLog.details,
        )
        .where(
            AccessLog.tenant_id == tenant_id,
            AccessLog.resource_id == warehouse_id,
            func.lower(func.coalesce(AccessLog.resource, "")).contains("warehouse"),
        )
        .order_by(AccessLog.logged_at.desc())
        .limit(50)
    ).all()
    if not audit_rows:
        audit_rows = db.execute(
            select(
                AuditLog.id,
                AuditLog.action,
                User.full_name,
                User.email,
                AuditLog.created_at,
                AuditLog.details,
            )
            .outerjoin(User, User.id == AuditLog.user_id)
            .where(
                AuditLog.tenant_id == tenant_id,
                AuditLog.resource_id == warehouse_id,
                func.lower(func.coalesce(AuditLog.resource, "")).contains("warehouse"),
            )
            .order_by(AuditLog.created_at.desc())
            .limit(50)
        ).all()
    detail.audit_events = [
        {
            "id": r[0],
            "action": r[1],
            "user": r[2] or r[3] or "System",
            "date": r[4].isoformat() if r[4] else None,
            "details": r[5],
        }
        for r in audit_rows
    ]

    today_date = datetime.now(timezone.utc).date()
    today_start = datetime(today_date.year, today_date.month, today_date.day, tzinfo=timezone.utc)

    daily_in = int(
        db.scalar(
            select(func.coalesce(func.sum(StockMovement.quantity), 0))
            .join(InventoryItem, StockMovement.item_id == InventoryItem.id)
            .where(
                StockMovement.tenant_id == tenant_id,
                StockMovement.warehouse_id == warehouse_id,
                InventoryItem.tenant_id == tenant_id,
                StockMovement.movement_type.in_(("in", "return", "purchase")),
                StockMovement.created_at >= today_start,
            )
        )
        or 0
    )

    daily_out = int(
        db.scalar(
            select(func.coalesce(func.sum(StockMovement.quantity), 0))
            .join(InventoryItem, StockMovement.item_id == InventoryItem.id)
            .where(
                StockMovement.tenant_id == tenant_id,
                StockMovement.warehouse_id == warehouse_id,
                InventoryItem.tenant_id == tenant_id,
                StockMovement.movement_type.in_(("out", "transfer_out", "consume")),
                StockMovement.created_at >= today_start,
            )
        )
        or 0
    )

    detail.daily_inward = daily_in
    detail.daily_outward = daily_out
    detail.bin_tree = []
    detail.rack_count = wh.rack_count
    detail.bin_count = wh.bin_count
    return detail


def create_warehouse_extended(db: Session, payload: WarehouseCreateExtended) -> Warehouse:
    wh = Warehouse(**payload.model_dump())
    db.add(wh)
    db.commit()
    db.refresh(wh)
    return wh


def update_warehouse(
    db: Session, tenant_id: int, warehouse_id: int, payload: WarehouseUpdate
) -> Warehouse | None:
    wh = db.scalars(
        select(Warehouse).where(
            Warehouse.id == warehouse_id, Warehouse.tenant_id == tenant_id
        )
    ).first()
    if not wh:
        return None
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(wh, key, value)
    db.commit()
    db.refresh(wh)
    return wh


def deactivate_warehouse(db: Session, tenant_id: int, warehouse_id: int) -> Warehouse | None:
    return update_warehouse(
        db, tenant_id, warehouse_id, WarehouseUpdate(status="inactive")
    )
