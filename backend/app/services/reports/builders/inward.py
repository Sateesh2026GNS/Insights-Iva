from __future__ import annotations

from datetime import date

from sqlalchemy import case, func, literal, select
from sqlalchemy.sql import Select

from app.models.inventory import InventoryItem, Supplier, Warehouse
from app.models.procurement import (
    GoodsReceipt,
    GoodsReceiptLine,
    PurchaseOrder,
    PurchaseOrderLine,
)
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import ReportColumn, register_report

INWARD_FILTERS = ["warehouse_ids", "vendor_ids", "date_from", "date_to", "status", "search"]


@register_report(
    key="grn_register",
    title="GRN Register",
    category="Inward",
    description="Goods receipt notes with ordered, received, and rejected quantities.",
    required_permission="procurement",
    columns=[
        ReportColumn("grn_no", "GRN no", drill_to={"type": "grn"}),
        ReportColumn("grn_date", "Date", "date"),
        ReportColumn("vendor", "Vendor"),
        ReportColumn("po_no", "PO no", drill_to={"type": "po"}),
        ReportColumn("item", "Item"),
        ReportColumn("ordered_qty", "Ordered", "qty", "right"),
        ReportColumn("received_qty", "Received", "qty", "right"),
        ReportColumn("accepted_qty", "Accepted", "qty", "right"),
        ReportColumn("rejected_qty", "Rejected", "qty", "right"),
        ReportColumn("warehouse", "Warehouse"),
        ReportColumn("status", "Status", "badge"),
    ],
    default_sort=("grn_date", "desc"),
    filters_supported=INWARD_FILTERS,
)
def build_grn_register(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    accepted = func.greatest(
        GoodsReceiptLine.quantity_received - GoodsReceiptLine.quantity_rejected, 0
    )
    stmt = select(
        GoodsReceipt.grn_number.label("grn_no"),
        GoodsReceipt.receipt_date.label("grn_date"),
        Supplier.name.label("vendor"),
        PurchaseOrder.po_number.label("po_no"),
        InventoryItem.name.label("item"),
        PurchaseOrderLine.quantity.label("ordered_qty"),
        GoodsReceiptLine.quantity_received.label("received_qty"),
        accepted.label("accepted_qty"),
        GoodsReceiptLine.quantity_rejected.label("rejected_qty"),
        Warehouse.name.label("warehouse"),
        GoodsReceipt.status.label("status"),
    ).join(GoodsReceiptLine, GoodsReceiptLine.goods_receipt_id == GoodsReceipt.id).join(
        InventoryItem, GoodsReceiptLine.item_id == InventoryItem.id
    ).join(Warehouse, GoodsReceipt.warehouse_id == Warehouse.id).outerjoin(
        PurchaseOrder, PurchaseOrder.id == GoodsReceipt.purchase_order_id
    ).outerjoin(Supplier, Supplier.id == PurchaseOrder.supplier_id).outerjoin(
        PurchaseOrderLine,
        (PurchaseOrderLine.purchase_order_id == PurchaseOrder.id)
        & (PurchaseOrderLine.item_id == GoodsReceiptLine.item_id),
    ).where(
        GoodsReceipt.tenant_id == ctx.tenant_id,
        GoodsReceipt.warehouse_id.in_(ctx.warehouse_ids),
    )
    column_map = {
        "date_col": GoodsReceipt.receipt_date,
        "warehouse_col": GoodsReceipt.warehouse_id,
        "vendor_col": PurchaseOrder.supplier_id,
        "status_col": GoodsReceipt.status,
        "search_col": GoodsReceipt.grn_number,
        "grn_date": GoodsReceipt.receipt_date,
    }
    return stmt, column_map


@register_report(
    key="pending_grn",
    title="Pending GRN",
    category="Inward",
    description="Approved purchase orders with pending or partial receipt.",
    required_permission="procurement",
    columns=[
        ReportColumn("po_no", "PO no", drill_to={"type": "po"}),
        ReportColumn("po_date", "PO date", "date"),
        ReportColumn("vendor", "Vendor"),
        ReportColumn("item", "Item"),
        ReportColumn("ordered_qty", "Ordered", "qty", "right"),
        ReportColumn("received_qty", "Received", "qty", "right"),
        ReportColumn("pending_qty", "Pending", "qty", "right"),
        ReportColumn("days_overdue", "Days overdue", "number", "right"),
    ],
    default_sort=("days_overdue", "desc"),
    filters_supported=["warehouse_ids", "vendor_ids", "date_from", "date_to", "search"],
)
def build_pending_grn(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    received_sub = (
        select(
            GoodsReceipt.purchase_order_id.label("po_id"),
            GoodsReceiptLine.item_id.label("item_id"),
            func.sum(GoodsReceiptLine.quantity_received).label("rcv"),
        )
        .join(GoodsReceiptLine, GoodsReceiptLine.goods_receipt_id == GoodsReceipt.id)
        .where(GoodsReceipt.tenant_id == ctx.tenant_id)
        .group_by(GoodsReceipt.purchase_order_id, GoodsReceiptLine.item_id)
        .subquery()
    )
    ordered = PurchaseOrderLine.quantity
    received = func.coalesce(received_sub.c.rcv, 0)
    pending = ordered - received
    # PostgreSQL: date - date yields integer days; date_part(day, int) is invalid.
    overdue_days = func.greatest(func.current_date() - PurchaseOrder.expected_date, 0)
    stmt = select(
        PurchaseOrder.po_number.label("po_no"),
        PurchaseOrder.order_date.label("po_date"),
        Supplier.name.label("vendor"),
        InventoryItem.name.label("item"),
        ordered.label("ordered_qty"),
        received.label("received_qty"),
        pending.label("pending_qty"),
        overdue_days.label("days_overdue"),
    ).join(PurchaseOrderLine, PurchaseOrderLine.purchase_order_id == PurchaseOrder.id).join(
        InventoryItem, PurchaseOrderLine.item_id == InventoryItem.id
    ).join(Supplier, PurchaseOrder.supplier_id == Supplier.id).outerjoin(
        received_sub,
        (received_sub.c.po_id == PurchaseOrder.id) & (received_sub.c.item_id == PurchaseOrderLine.item_id),
    ).where(
        PurchaseOrder.tenant_id == ctx.tenant_id,
        PurchaseOrder.status.in_(("approved", "partial", "confirmed")),
        pending > 0,
    )
    if ctx.warehouse_ids:
        stmt = stmt.where(
            (PurchaseOrder.warehouse_id.in_(ctx.warehouse_ids))
            | (PurchaseOrder.warehouse_id.is_(None))
        )
    column_map = {
        "date_col": PurchaseOrder.order_date,
        "vendor_col": PurchaseOrder.supplier_id,
        "search_col": PurchaseOrder.po_number,
        "days_overdue": overdue_days,
    }
    return stmt, column_map


@register_report(
    key="qc_rejection",
    title="QC Rejection",
    category="Inward",
    description="GRN lines with rejected quantity and rejection rate.",
    required_permission="procurement",
    columns=[
        ReportColumn("grn_no", "GRN no", drill_to={"type": "grn"}),
        ReportColumn("item", "Item"),
        ReportColumn("vendor", "Vendor"),
        ReportColumn("rejected_qty", "Rejected", "qty", "right"),
        ReportColumn("rejection_pct", "Rejection %", "number", "right"),
        ReportColumn("reason", "Reason"),
    ],
    default_sort=("rejection_pct", "desc"),
    filters_supported=INWARD_FILTERS,
)
def build_qc_rejection(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    pct = case(
        (GoodsReceiptLine.quantity_received > 0, (GoodsReceiptLine.quantity_rejected / GoodsReceiptLine.quantity_received) * 100),
        else_=literal(0),
    )
    stmt = select(
        GoodsReceipt.grn_number.label("grn_no"),
        InventoryItem.name.label("item"),
        Supplier.name.label("vendor"),
        GoodsReceiptLine.quantity_rejected.label("rejected_qty"),
        pct.label("rejection_pct"),
        GoodsReceipt.notes.label("reason"),
    ).join(GoodsReceiptLine, GoodsReceiptLine.goods_receipt_id == GoodsReceipt.id).join(
        InventoryItem, GoodsReceiptLine.item_id == InventoryItem.id
    ).outerjoin(PurchaseOrder, PurchaseOrder.id == GoodsReceipt.purchase_order_id).outerjoin(
        Supplier, Supplier.id == PurchaseOrder.supplier_id
    ).where(
        GoodsReceipt.tenant_id == ctx.tenant_id,
        GoodsReceipt.warehouse_id.in_(ctx.warehouse_ids),
        GoodsReceiptLine.quantity_rejected > 0,
    )
    column_map = {
        "date_col": GoodsReceipt.receipt_date,
        "warehouse_col": GoodsReceipt.warehouse_id,
        "vendor_col": PurchaseOrder.supplier_id,
        "status_col": GoodsReceipt.qc_status,
        "search_col": GoodsReceipt.grn_number,
        "rejection_pct": pct,
    }
    return stmt, column_map
