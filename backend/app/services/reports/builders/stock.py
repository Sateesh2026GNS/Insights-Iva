from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy import case, func, literal, select, and_, or_
from sqlalchemy.sql import Select

from app.models.inventory import InventoryItem, StockLevel, StockMovement, Warehouse
from app.models.product import InventoryCategory
from app.models.inventory import Supplier
from app.models.procurement import PurchaseOrder, PurchaseOrderLine
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import ReportColumn, register_report
from app.services.reports.valuation import valuation_rate

STOCK_FILTERS = [
    "warehouse_ids",
    "item_ids",
    "item_category_ids",
    "search",
    "date_from",
    "date_to",
]


def _base_stock_join():
    return (
        select()
        .select_from(StockLevel)
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
    )


@register_report(
    key="current_stock",
    title="Current Stock",
    category="Stock & valuation",
    description="On-hand, reserved, and free quantity by item and warehouse.",
    required_permission="inventory",
    columns=[
        ReportColumn("item", "Item"),
        ReportColumn("item_code", "Item code"),
        ReportColumn("uom", "UoM"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("on_hand_qty", "On hand", "qty", "right"),
        ReportColumn("reserved_qty", "Reserved", "qty", "right"),
        ReportColumn("free_qty", "Free", "qty", "right"),
        ReportColumn("min_level", "Min level", "qty", "right"),
        ReportColumn("valuation_rate", "Valuation rate", "currency", "right"),
        ReportColumn("stock_value", "Stock value", "currency", "right"),
        ReportColumn("is_low", "Low stock", "badge", "center"),
    ],
    default_sort=("item", "asc"),
    filters_supported=["warehouse_ids", "item_ids", "item_category_ids", "search"],
)
def build_current_stock(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    on_hand = StockLevel.quantity
    reserved = func.coalesce(InventoryItem.reserved, 0)
    free = on_hand - reserved
    rate = func.coalesce(InventoryItem.unit_cost, 0)
    value = on_hand * rate
    is_low = case((on_hand < InventoryItem.reorder_level, literal("Yes")), else_=literal("No"))
    stmt = select(
        InventoryItem.name.label("item"),
        InventoryItem.sku.label("item_code"),
        InventoryItem.unit.label("uom"),
        Warehouse.name.label("warehouse"),
        on_hand.label("on_hand_qty"),
        reserved.label("reserved_qty"),
        free.label("free_qty"),
        InventoryItem.reorder_level.label("min_level"),
        rate.label("valuation_rate"),
        value.label("stock_value"),
        is_low.label("is_low"),
        InventoryItem.id.label("item_id"),
        StockLevel.warehouse_id.label("warehouse_id"),
        InventoryItem.category.label("item_category"),
    ).select_from(StockLevel).join(InventoryItem).join(Warehouse).where(
        InventoryItem.tenant_id == ctx.tenant_id,
        StockLevel.warehouse_id.in_(ctx.warehouse_ids),
    )
    column_map = {
        "warehouse_col": StockLevel.warehouse_id,
        "item_col": InventoryItem.id,
        "search_col": InventoryItem.name,
        "item_category_col": InventoryItem.category,
        "item": InventoryItem.name,
        "on_hand_qty": on_hand,
    }
    return stmt, column_map


@register_report(
    key="stock_ledger",
    title="Stock Ledger",
    category="Stock & valuation",
    description="Stock movements with in/out quantities and running balance.",
    required_permission="inventory",
    columns=[
        ReportColumn("txn_date", "Date", "date"),
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("ref_type", "Ref type"),
        ReportColumn(
            "ref_no",
            "Ref no",
            drill_to={"type": "document"},
        ),
        ReportColumn("in_qty", "In", "qty", "right"),
        ReportColumn("out_qty", "Out", "qty", "right"),
        ReportColumn("balance", "Balance", "qty", "right"),
    ],
    default_sort=("txn_date", "desc"),
    filters_supported=STOCK_FILTERS,
)
def build_stock_ledger(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    in_qty = case((StockMovement.movement_type.in_(("in", "purchase", "return", "transfer")), StockMovement.quantity), else_=0)
    out_qty = case((StockMovement.movement_type.in_(("out", "sales", "production", "scrap")), StockMovement.quantity), else_=0)
    stmt = select(
        func.date(StockMovement.created_at).label("txn_date"),
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        StockMovement.movement_type.label("ref_type"),
        StockMovement.reference.label("ref_no"),
        in_qty.label("in_qty"),
        out_qty.label("out_qty"),
        literal(0).label("balance"),
        StockMovement.item_id.label("item_id"),
        StockMovement.warehouse_id.label("warehouse_id"),
    ).join(InventoryItem, StockMovement.item_id == InventoryItem.id).join(
        Warehouse, StockMovement.warehouse_id == Warehouse.id
    ).where(
        StockMovement.tenant_id == ctx.tenant_id,
        StockMovement.warehouse_id.in_(ctx.warehouse_ids),
    )
    column_map = {
        "date_col": func.date(StockMovement.created_at),
        "warehouse_col": StockMovement.warehouse_id,
        "item_col": StockMovement.item_id,
        "search_col": InventoryItem.name,
        "item_category_col": InventoryItem.category,
        "txn_date": StockMovement.created_at,
    }
    return stmt, column_map


@register_report(
    key="reorder_low_stock",
    title="Reorder / Low Stock",
    category="Stock & valuation",
    description="Items at or below minimum stock with shortage and suggested order quantity.",
    required_permission="inventory",
    columns=[
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("on_hand_qty", "On hand", "qty", "right"),
        ReportColumn("min_level", "Min level", "qty", "right"),
        ReportColumn("shortage_qty", "Shortage", "qty", "right"),
        ReportColumn("suggested_order_qty", "Suggested order", "qty", "right"),
        ReportColumn("last_purchase_date", "Last purchase", "date"),
        ReportColumn("primary_vendor", "Primary vendor"),
    ],
    default_sort=("shortage_qty", "desc"),
    filters_supported=["warehouse_ids", "item_ids", "search"],
)
def build_reorder_low_stock(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    on_hand = StockLevel.quantity
    shortage = func.greatest(InventoryItem.reorder_level - on_hand, 0)
    max_level = InventoryItem.reorder_level * 2
    suggested = func.greatest(max_level - on_hand, 0)
    last_po = (
        select(func.max(PurchaseOrder.order_date))
        .join(PurchaseOrderLine, PurchaseOrderLine.purchase_order_id == PurchaseOrder.id)
        .where(
            PurchaseOrder.tenant_id == ctx.tenant_id,
            PurchaseOrderLine.item_id == InventoryItem.id,
        )
        .correlate(InventoryItem)
        .scalar_subquery()
    )
    stmt = select(
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        on_hand.label("on_hand_qty"),
        InventoryItem.reorder_level.label("min_level"),
        shortage.label("shortage_qty"),
        suggested.label("suggested_order_qty"),
        last_po.label("last_purchase_date"),
        Supplier.name.label("primary_vendor"),
    ).select_from(StockLevel).join(InventoryItem).join(Warehouse).outerjoin(
        Supplier, Supplier.id == InventoryItem.supplier_id
    ).where(
        InventoryItem.tenant_id == ctx.tenant_id,
        StockLevel.warehouse_id.in_(ctx.warehouse_ids),
        on_hand <= InventoryItem.reorder_level,
    )
    column_map = {
        "warehouse_col": StockLevel.warehouse_id,
        "item_col": InventoryItem.id,
        "search_col": InventoryItem.name,
        "shortage_qty": shortage,
    }
    return stmt, column_map


@register_report(
    key="dead_stock",
    title="Dead Stock",
    category="Stock & valuation",
    description="Items with no outward movement in the selected period.",
    required_permission="inventory",
    columns=[
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("on_hand_qty", "On hand", "qty", "right"),
        ReportColumn("last_movement_date", "Last movement", "date"),
        ReportColumn("blocked_value", "Blocked value", "currency", "right"),
    ],
    default_sort=("blocked_value", "desc"),
    filters_supported=["warehouse_ids", "date_from", "date_to", "search"],
)
def build_dead_stock(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    out_types = ("out", "sales", "production", "scrap")
    period_out = (
        select(StockMovement.item_id, StockMovement.warehouse_id)
        .where(
            StockMovement.tenant_id == ctx.tenant_id,
            StockMovement.movement_type.in_(out_types),
        )
    )
    if filters.date_from:
        period_out = period_out.where(func.date(StockMovement.created_at) >= filters.date_from)
    if filters.date_to:
        period_out = period_out.where(func.date(StockMovement.created_at) <= filters.date_to)
    moved = period_out.distinct().subquery()

    last_mv = (
        select(
            StockMovement.item_id,
            StockMovement.warehouse_id,
            func.max(func.date(StockMovement.created_at)).label("last_dt"),
        )
        .where(StockMovement.tenant_id == ctx.tenant_id)
        .group_by(StockMovement.item_id, StockMovement.warehouse_id)
        .subquery()
    )
    on_hand = StockLevel.quantity
    value = on_hand * func.coalesce(InventoryItem.unit_cost, 0)
    stmt = select(
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        on_hand.label("on_hand_qty"),
        last_mv.c.last_dt.label("last_movement_date"),
        value.label("blocked_value"),
    ).select_from(StockLevel).join(InventoryItem).join(Warehouse).outerjoin(
        last_mv,
        and_(last_mv.c.item_id == StockLevel.item_id, last_mv.c.warehouse_id == StockLevel.warehouse_id),
    ).outerjoin(
        moved,
        and_(moved.c.item_id == StockLevel.item_id, moved.c.warehouse_id == StockLevel.warehouse_id),
    ).where(
        InventoryItem.tenant_id == ctx.tenant_id,
        StockLevel.warehouse_id.in_(ctx.warehouse_ids),
        on_hand > 0,
        moved.c.item_id.is_(None),
    )
    column_map = {
        "warehouse_col": StockLevel.warehouse_id,
        "search_col": InventoryItem.name,
        "date_col": last_mv.c.last_dt,
        "blocked_value": value,
    }
    return stmt, column_map


@register_report(
    key="inventory_ageing",
    title="Inventory Ageing",
    category="Stock & valuation",
    description="Quantity and value by ageing bucket based on last stock-in date.",
    required_permission="inventory",
    columns=[
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("bucket", "Bucket"),
        ReportColumn("qty", "Qty", "qty", "right"),
        ReportColumn("value", "Value", "currency", "right"),
    ],
    default_sort=("item", "asc"),
    filters_supported=["warehouse_ids", "item_ids", "search"],
)
def build_inventory_ageing(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    today = date.today()
    b30 = today - timedelta(days=30)
    b60 = today - timedelta(days=60)
    b90 = today - timedelta(days=90)
    last_in = (
        select(
            StockMovement.item_id,
            StockMovement.warehouse_id,
            func.max(func.date(StockMovement.created_at)).label("receipt_date"),
        )
        .where(
            StockMovement.tenant_id == ctx.tenant_id,
            StockMovement.movement_type.in_(("in", "purchase", "return")),
        )
        .group_by(StockMovement.item_id, StockMovement.warehouse_id)
        .subquery()
    )
    bucket = case(
        (last_in.c.receipt_date >= b30, literal("0-30 days")),
        (last_in.c.receipt_date >= b60, literal("31-60 days")),
        (last_in.c.receipt_date >= b90, literal("61-90 days")),
        else_=literal("90+ days"),
    )
    qty = StockLevel.quantity
    value = qty * func.coalesce(InventoryItem.unit_cost, 0)
    stmt = select(
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        bucket.label("bucket"),
        qty.label("qty"),
        value.label("value"),
    ).select_from(StockLevel).join(InventoryItem).join(Warehouse).join(
        last_in,
        and_(last_in.c.item_id == StockLevel.item_id, last_in.c.warehouse_id == StockLevel.warehouse_id),
    ).where(
        InventoryItem.tenant_id == ctx.tenant_id,
        StockLevel.warehouse_id.in_(ctx.warehouse_ids),
        qty > 0,
    )
    column_map = {
        "warehouse_col": StockLevel.warehouse_id,
        "item_col": InventoryItem.id,
        "search_col": InventoryItem.name,
        "item": InventoryItem.name,
    }
    return stmt, column_map


@register_report(
    key="batch_expiry",
    title="Batch Expiry",
    category="Stock & valuation",
    description="Batch-tracked lines with manufacturing and expiry dates.",
    required_permission="inventory",
    columns=[
        ReportColumn("batch_no", "Batch no"),
        ReportColumn("item", "Item"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("mfg_date", "Mfg date", "date"),
        ReportColumn("expiry_date", "Expiry", "date"),
        ReportColumn("qty", "Qty", "qty", "right"),
        ReportColumn("days_to_expiry", "Days to expiry", "number", "right"),
    ],
    default_sort=("days_to_expiry", "asc"),
    filters_supported=["warehouse_ids", "date_from", "date_to", "search"],
)
def build_batch_expiry(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    from app.models.inventory import StockInDocument, StockInLine

    days = StockInLine.expiry_date - func.current_date()
    stmt = select(
        StockInLine.batch_number.label("batch_no"),
        InventoryItem.name.label("item"),
        Warehouse.name.label("warehouse"),
        StockInLine.manufacturing_date.label("mfg_date"),
        StockInLine.expiry_date.label("expiry_date"),
        StockInLine.received_qty.label("qty"),
        days.label("days_to_expiry"),
    ).join(StockInDocument, StockInLine.stock_in_id == StockInDocument.id).join(
        InventoryItem, StockInLine.item_id == InventoryItem.id
    ).join(Warehouse, StockInDocument.warehouse_id == Warehouse.id).where(
        StockInDocument.tenant_id == ctx.tenant_id,
        StockInDocument.warehouse_id.in_(ctx.warehouse_ids),
        StockInLine.batch_number.isnot(None),
        StockInLine.expiry_date.isnot(None),
    )
    column_map = {
        "warehouse_col": StockInDocument.warehouse_id,
        "date_col": StockInLine.expiry_date,
        "search_col": InventoryItem.name,
        "days_to_expiry": days,
    }
    return stmt, column_map
