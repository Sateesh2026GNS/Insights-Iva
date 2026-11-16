"""Extended catalog handlers (sales, finance, logistics, audit) — tenant-scoped."""

from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.sql import Select

from app.models.automation import AutomationExecution
from app.models.export_packing import ExportPackingList
from app.models.inventory import Supplier
from app.models.product import Product
from app.models.procurement import (
    GoodsReceipt,
    PurchaseOrder,
    PurchaseOrderLine,
    SupplierPayment,
    VendorBill,
)
from app.models.sales import Customer, DispatchShipment, Invoice, Payment, SalesOrder, SalesOrderLine
from app.models.security import AccessLog
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters
from app.services.reports.registry import ReportColumn, register_report

_DATE_FILTERS = ["date_from", "date_to", "search", "status"]


def _tenant_date(stmt, model, ctx: ReportBuildContext, filters: ReportFilters, date_col):
    stmt = stmt.where(model.tenant_id == ctx.tenant_id)
    if filters.date_from is not None:
        stmt = stmt.where(date_col >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(date_col <= filters.date_to)
    return stmt


@register_report(
    key="sales_summary",
    title="Sales Summary",
    category="Sales",
    description="Sales orders in the selected period.",
    required_permission="sales",
    columns=[
        ReportColumn("order_number", "Order #"),
        ReportColumn("order_date", "Date", "date"),
        ReportColumn("customer", "Customer"),
        ReportColumn("status", "Status", "badge"),
        ReportColumn("total_amount", "Amount", "currency", "right"),
    ],
    default_sort=("order_date", "desc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_sales_summary(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            SalesOrder.order_number.label("order_number"),
            SalesOrder.order_date.label("order_date"),
            Customer.name.label("customer"),
            SalesOrder.status.label("status"),
            SalesOrder.total_amount.label("total_amount"),
        )
        .join(Customer, SalesOrder.customer_id == Customer.id)
    )
    stmt = _tenant_date(stmt, SalesOrder, ctx, filters, SalesOrder.order_date)
    if filters.status:
        stmt = stmt.where(SalesOrder.status == filters.status)
    return stmt, {"order_date": SalesOrder.order_date, "search_col": SalesOrder.order_number}


@register_report(
    key="sales_order_details",
    title="Sales Order Details",
    category="Receivables",
    description="Line-level sales order details.",
    required_permission="sales",
    columns=[
        ReportColumn("order_number", "Order #"),
        ReportColumn("order_date", "Date", "date"),
        ReportColumn("customer", "Customer"),
        ReportColumn("item", "Item"),
        ReportColumn("quantity", "Qty", "qty", "right"),
        ReportColumn("line_total", "Line total", "currency", "right"),
    ],
    default_sort=("order_date", "desc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_sales_order_details(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            SalesOrder.order_number.label("order_number"),
            SalesOrder.order_date.label("order_date"),
            Customer.name.label("customer"),
            SalesOrderLine.item_description.label("item"),
            SalesOrderLine.quantity.label("quantity"),
            SalesOrderLine.line_total.label("line_total"),
        )
        .join(Customer)
        .join(SalesOrderLine)
    )
    stmt = _tenant_date(stmt, SalesOrder, ctx, filters, SalesOrder.order_date)
    return stmt, {"order_date": SalesOrder.order_date}


@register_report(
    key="sales_by_customer",
    title="Sales by Customer",
    category="Sales",
    description="Revenue grouped by customer.",
    required_permission="sales",
    columns=[
        ReportColumn("customer", "Customer"),
        ReportColumn("order_count", "Orders", "number", "right"),
        ReportColumn("total_amount", "Revenue", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_sales_by_customer(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Customer.name.label("customer"),
            func.count(SalesOrder.id).label("order_count"),
            func.coalesce(func.sum(SalesOrder.total_amount), 0).label("total_amount"),
        )
        .join(SalesOrder, SalesOrder.customer_id == Customer.id)
        .where(Customer.tenant_id == ctx.tenant_id)
        .group_by(Customer.id, Customer.name)
    )
    if filters.date_from:
        stmt = stmt.where(SalesOrder.order_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(SalesOrder.order_date <= filters.date_to)
    return stmt, {"total_amount": func.sum(SalesOrder.total_amount)}


@register_report(
    key="sales_by_item",
    title="Sales by Item",
    category="Sales",
    description="Revenue grouped by line item description.",
    required_permission="sales",
    columns=[
        ReportColumn("item", "Item"),
        ReportColumn("quantity", "Qty sold", "qty", "right"),
        ReportColumn("total_amount", "Revenue", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_sales_by_item(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            SalesOrderLine.item_description.label("item"),
            func.coalesce(func.sum(SalesOrderLine.quantity), 0).label("quantity"),
            func.coalesce(func.sum(SalesOrderLine.line_total), 0).label("total_amount"),
        )
        .join(SalesOrder)
        .where(SalesOrder.tenant_id == ctx.tenant_id)
        .group_by(SalesOrderLine.item_description)
    )
    if filters.date_from:
        stmt = stmt.where(SalesOrder.order_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(SalesOrder.order_date <= filters.date_to)
    return stmt, {"total_amount": func.sum(SalesOrderLine.line_total)}


@register_report(
    key="sales_by_category",
    title="Sales by Category",
    category="Sales",
    description="Revenue by product category when product is linked.",
    required_permission="sales",
    columns=[
        ReportColumn("category", "Category"),
        ReportColumn("total_amount", "Revenue", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_sales_by_category(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    category = func.coalesce(Product.category, "Uncategorized")
    stmt = (
        select(
            category.label("category"),
            func.coalesce(func.sum(SalesOrderLine.line_total), 0).label("total_amount"),
        )
        .select_from(SalesOrderLine)
        .join(SalesOrder)
        .outerjoin(Product, SalesOrderLine.product_id == Product.id)
        .where(SalesOrder.tenant_id == ctx.tenant_id)
        .group_by(category)
    )
    if filters.date_from:
        stmt = stmt.where(SalesOrder.order_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(SalesOrder.order_date <= filters.date_to)
    return stmt, {"total_amount": func.sum(SalesOrderLine.line_total)}


@register_report(
    key="sales_by_salesperson",
    title="Sales by Salesperson",
    category="Sales",
    description="Orders grouped by sales person.",
    required_permission="sales",
    columns=[
        ReportColumn("sales_person", "Salesperson"),
        ReportColumn("order_count", "Orders", "number", "right"),
        ReportColumn("total_amount", "Amount", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_sales_by_salesperson(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    sp = func.coalesce(SalesOrder.sales_person, "Unassigned")
    stmt = (
        select(
            sp.label("sales_person"),
            func.count(SalesOrder.id).label("order_count"),
            func.coalesce(func.sum(SalesOrder.total_amount), 0).label("total_amount"),
        )
        .where(SalesOrder.tenant_id == ctx.tenant_id)
        .group_by(sp)
    )
    if filters.date_from:
        stmt = stmt.where(SalesOrder.order_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(SalesOrder.order_date <= filters.date_to)
    return stmt, {"total_amount": func.sum(SalesOrder.total_amount)}


@register_report(
    key="order_fulfillment_by_item",
    title="Order Fulfillment By Item",
    category="Sales",
    description="Ordered vs shipped flags by order line.",
    required_permission="sales",
    columns=[
        ReportColumn("order_number", "Order #"),
        ReportColumn("item", "Item"),
        ReportColumn("quantity", "Qty", "qty", "right"),
        ReportColumn("packed", "Packed", "badge"),
        ReportColumn("shipped", "Shipped", "badge"),
    ],
    default_sort=("order_number", "asc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_order_fulfillment(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    from sqlalchemy import case, literal

    packed = case((SalesOrder.packed.is_(True), literal("Yes")), else_=literal("No"))
    shipped = case((SalesOrder.shipped.is_(True), literal("Yes")), else_=literal("No"))
    stmt = (
        select(
            SalesOrder.order_number.label("order_number"),
            SalesOrderLine.item_description.label("item"),
            SalesOrderLine.quantity.label("quantity"),
            packed.label("packed"),
            shipped.label("shipped"),
        )
        .join(SalesOrderLine)
    )
    stmt = _tenant_date(stmt, SalesOrder, ctx, filters, SalesOrder.order_date)
    return stmt, {}


@register_report(
    key="invoice_details",
    title="Invoice Details",
    category="Receivables",
    description="Customer invoices in the period.",
    required_permission="sales",
    columns=[
        ReportColumn("invoice_number", "Invoice #"),
        ReportColumn("issue_date", "Date", "date"),
        ReportColumn("customer", "Customer"),
        ReportColumn("payment_status", "Payment", "badge"),
        ReportColumn("grand_total", "Total", "currency", "right"),
        ReportColumn("amount_paid", "Paid", "currency", "right"),
    ],
    default_sort=("issue_date", "desc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_invoice_details(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Invoice.invoice_number.label("invoice_number"),
            Invoice.issue_date.label("issue_date"),
            Customer.name.label("customer"),
            Invoice.payment_status.label("payment_status"),
            Invoice.grand_total.label("grand_total"),
            Invoice.amount_paid.label("amount_paid"),
        )
        .join(Customer)
    )
    stmt = _tenant_date(stmt, Invoice, ctx, filters, Invoice.issue_date)
    return stmt, {"issue_date": Invoice.issue_date}


@register_report(
    key="receivable_summary",
    title="Receivable Summary",
    category="Receivables",
    description="Open invoice balances by customer.",
    required_permission="accounts",
    columns=[
        ReportColumn("customer", "Customer"),
        ReportColumn("open_balance", "Open balance", "currency", "right"),
    ],
    default_sort=("open_balance", "desc"),
    filters_supported=["date_to"],
    requires_warehouse=False,
)
def build_receivable_summary(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    balance = Invoice.grand_total - Invoice.amount_paid
    stmt = (
        select(
            Customer.name.label("customer"),
            func.coalesce(func.sum(balance), 0).label("open_balance"),
        )
        .join(Invoice, Invoice.customer_id == Customer.id)
        .where(
            Customer.tenant_id == ctx.tenant_id,
            Invoice.invoice_status == "active",
            balance > 0,
        )
        .group_by(Customer.id, Customer.name)
    )
    return stmt, {"open_balance": func.sum(balance)}


@register_report(
    key="customer_balance_summary",
    title="Customer Balance Summary",
    category="Receivables",
    description="Same as receivable summary — customer open balances.",
    required_permission="accounts",
    columns=[
        ReportColumn("customer", "Customer"),
        ReportColumn("open_balance", "Balance", "currency", "right"),
    ],
    default_sort=("open_balance", "desc"),
    filters_supported=[],
    requires_warehouse=False,
)
def build_customer_balance_summary(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    return build_receivable_summary(ctx, filters)


@register_report(
    key="payments_received",
    title="Payments Received",
    category="Payments Received",
    description="Customer payments recorded against invoices.",
    required_permission="accounts",
    columns=[
        ReportColumn("payment_date", "Date", "date"),
        ReportColumn("invoice_number", "Invoice #"),
        ReportColumn("amount", "Amount", "currency", "right"),
        ReportColumn("method", "Method"),
    ],
    default_sort=("payment_date", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_payments_received(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Payment.payment_date.label("payment_date"),
            Invoice.invoice_number.label("invoice_number"),
            Payment.amount.label("amount"),
            Payment.method.label("method"),
        )
        .join(Invoice)
        .where(Payment.tenant_id == ctx.tenant_id)
    )
    if filters.date_from:
        stmt = stmt.where(Payment.payment_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(Payment.payment_date <= filters.date_to)
    return stmt, {"payment_date": Payment.payment_date}


@register_report(
    key="purchase_order_details",
    title="Purchase Order Details",
    category="Payables",
    description="Purchase orders with supplier.",
    required_permission="procurement",
    columns=[
        ReportColumn("po_number", "PO #"),
        ReportColumn("order_date", "Date", "date"),
        ReportColumn("supplier", "Vendor"),
        ReportColumn("status", "Status", "badge"),
        ReportColumn("total_amount", "Amount", "currency", "right"),
    ],
    default_sort=("order_date", "desc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_purchase_order_details(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            PurchaseOrder.po_number.label("po_number"),
            PurchaseOrder.order_date.label("order_date"),
            Supplier.name.label("supplier"),
            PurchaseOrder.status.label("status"),
            PurchaseOrder.total_amount.label("total_amount"),
        )
        .join(Supplier)
    )
    stmt = _tenant_date(stmt, PurchaseOrder, ctx, filters, PurchaseOrder.order_date)
    return stmt, {"order_date": PurchaseOrder.order_date}


@register_report(
    key="purchase_orders_by_vendor",
    title="Purchase Orders by Vendor",
    category="Payables",
    description="PO totals grouped by supplier.",
    required_permission="procurement",
    columns=[
        ReportColumn("supplier", "Vendor"),
        ReportColumn("po_count", "POs", "number", "right"),
        ReportColumn("total_amount", "Amount", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_purchase_orders_by_vendor(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Supplier.name.label("supplier"),
            func.count(PurchaseOrder.id).label("po_count"),
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0).label("total_amount"),
        )
        .join(PurchaseOrder)
        .where(Supplier.tenant_id == ctx.tenant_id)
        .group_by(Supplier.id, Supplier.name)
    )
    if filters.date_from:
        stmt = stmt.where(PurchaseOrder.order_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(PurchaseOrder.order_date <= filters.date_to)
    return stmt, {"total_amount": func.sum(PurchaseOrder.total_amount)}


@register_report(
    key="purchase_order_by_item",
    title="Purchase Order By Item",
    category="Payables",
    description="PO lines by inventory item.",
    required_permission="procurement",
    columns=[
        ReportColumn("po_number", "PO #"),
        ReportColumn("item", "Item"),
        ReportColumn("quantity", "Qty", "qty", "right"),
        ReportColumn("line_total", "Line total", "currency", "right"),
    ],
    default_sort=("po_number", "asc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_purchase_order_by_item(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    from app.models.inventory import InventoryItem

    stmt = (
        select(
            PurchaseOrder.po_number.label("po_number"),
            InventoryItem.name.label("item"),
            PurchaseOrderLine.quantity.label("quantity"),
            PurchaseOrderLine.line_total.label("line_total"),
        )
        .join(PurchaseOrderLine)
        .join(InventoryItem)
    )
    stmt = _tenant_date(stmt, PurchaseOrder, ctx, filters, PurchaseOrder.order_date)
    return stmt, {}


@register_report(
    key="bill_details",
    title="Bill Details",
    category="Payables",
    description="Vendor bills.",
    required_permission="procurement",
    columns=[
        ReportColumn("bill_number", "Bill #"),
        ReportColumn("bill_date", "Date", "date"),
        ReportColumn("supplier", "Vendor"),
        ReportColumn("total_amount", "Amount", "currency", "right"),
        ReportColumn("status", "Status", "badge"),
    ],
    default_sort=("bill_date", "desc"),
    filters_supported=_DATE_FILTERS,
    requires_warehouse=False,
)
def build_bill_details(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            VendorBill.bill_number.label("bill_number"),
            VendorBill.bill_date.label("bill_date"),
            Supplier.name.label("supplier"),
            VendorBill.amount.label("total_amount"),
            VendorBill.status.label("status"),
        )
        .join(Supplier, VendorBill.supplier_id == Supplier.id)
        .where(VendorBill.tenant_id == ctx.tenant_id)
    )
    if filters.date_from:
        stmt = stmt.where(VendorBill.bill_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(VendorBill.bill_date <= filters.date_to)
    return stmt, {"bill_date": VendorBill.bill_date}


@register_report(
    key="payable_summary",
    title="Payable Summary",
    category="Payables",
    description="Vendor bill totals by supplier.",
    required_permission="procurement",
    columns=[
        ReportColumn("supplier", "Vendor"),
        ReportColumn("total_amount", "Bill total", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_payable_summary(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Supplier.name.label("supplier"),
            func.coalesce(func.sum(VendorBill.total_amount), 0).label("total_amount"),
        )
        .join(VendorBill)
        .where(Supplier.tenant_id == ctx.tenant_id)
        .group_by(Supplier.id, Supplier.name)
    )
    if filters.date_from:
        stmt = stmt.where(VendorBill.bill_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(VendorBill.bill_date <= filters.date_to)
    return stmt, {"total_amount": func.sum(VendorBill.total_amount)}


@register_report(
    key="vendor_balance_summary",
    title="Vendor Balance Summary",
    category="Payables",
    description="Approved bill totals by vendor (simplified AP view).",
    required_permission="procurement",
    columns=[
        ReportColumn("supplier", "Vendor"),
        ReportColumn("total_amount", "Balance", "currency", "right"),
    ],
    default_sort=("total_amount", "desc"),
    filters_supported=[],
    requires_warehouse=False,
)
def build_vendor_balance_summary(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    return build_payable_summary(ctx, filters)


@register_report(
    key="payments_made",
    title="Payments Made",
    category="Payables",
    description="Supplier payments.",
    required_permission="procurement",
    columns=[
        ReportColumn("payment_date", "Date", "date"),
        ReportColumn("supplier", "Vendor"),
        ReportColumn("amount", "Amount", "currency", "right"),
        ReportColumn("reference", "Reference"),
    ],
    default_sort=("payment_date", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_payments_made(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            SupplierPayment.payment_date.label("payment_date"),
            Supplier.name.label("supplier"),
            SupplierPayment.amount.label("amount"),
            SupplierPayment.reference.label("reference"),
        )
        .join(Supplier)
        .where(SupplierPayment.tenant_id == ctx.tenant_id)
    )
    if filters.date_from:
        stmt = stmt.where(SupplierPayment.payment_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(SupplierPayment.payment_date <= filters.date_to)
    return stmt, {"payment_date": SupplierPayment.payment_date}


@register_report(
    key="shipment_details",
    title="Shipment Details",
    category="Inventory",
    description="Dispatch shipments linked to sales orders.",
    required_permission="inventory",
    columns=[
        ReportColumn("shipment_number", "Shipment #"),
        ReportColumn("ship_date", "Date", "date"),
        ReportColumn("order_number", "Sales order"),
        ReportColumn("status", "Status", "badge"),
    ],
    default_sort=("ship_date", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_shipment_details(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            DispatchShipment.shipment_number.label("shipment_number"),
            DispatchShipment.ship_date.label("ship_date"),
            SalesOrder.order_number.label("order_number"),
            DispatchShipment.status.label("status"),
        )
        .outerjoin(SalesOrder)
        .where(DispatchShipment.tenant_id == ctx.tenant_id)
    )
    if filters.date_from:
        stmt = stmt.where(DispatchShipment.ship_date >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(DispatchShipment.ship_date <= filters.date_to)
    return stmt, {"ship_date": DispatchShipment.ship_date}


@register_report(
    key="packing_history",
    title="Packing History",
    category="Inventory",
    description="Export packing lists.",
    required_permission="inventory",
    columns=[
        ReportColumn("packing_number", "Packing #"),
        ReportColumn("created_at", "Created", "date"),
        ReportColumn("status", "Status", "badge"),
    ],
    default_sort=("created_at", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_packing_history(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = select(
        ExportPackingList.packing_number.label("packing_number"),
        func.date(ExportPackingList.created_at).label("created_at"),
        ExportPackingList.status.label("status"),
    ).where(ExportPackingList.tenant_id == ctx.tenant_id)
    if filters.date_from:
        stmt = stmt.where(func.date(ExportPackingList.created_at) >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(func.date(ExportPackingList.created_at) <= filters.date_to)
    return stmt, {}


@register_report(
    key="activity_logs_audit_trail",
    title="Activity Logs & Audit Trail",
    category="Activity",
    description="Security access log entries.",
    required_permission="admin",
    columns=[
        ReportColumn("created_at", "When", "date"),
        ReportColumn("action", "Action"),
        ReportColumn("resource", "Resource"),
        ReportColumn("user_email", "User"),
    ],
    default_sort=("created_at", "desc"),
    filters_supported=["date_from", "date_to", "search"],
    requires_warehouse=False,
)
def build_activity_logs(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            AccessLog.created_at.label("created_at"),
            AccessLog.action.label("action"),
            AccessLog.resource.label("resource"),
            AccessLog.user_email.label("user_email"),
        )
        .where(AccessLog.tenant_id == ctx.tenant_id)
    )
    if filters.date_from:
        stmt = stmt.where(func.date(AccessLog.created_at) >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(func.date(AccessLog.created_at) <= filters.date_to)
    return stmt, {"created_at": AccessLog.created_at}


@register_report(
    key="workflow_execution_logs",
    title="Workflow Execution Logs",
    category="Automation",
    description="Automation rule execution history.",
    required_permission="admin",
    columns=[
        ReportColumn("started_at", "Started", "date"),
        ReportColumn("rule_name", "Rule"),
        ReportColumn("status", "Status", "badge"),
        ReportColumn("message", "Message"),
    ],
    default_sort=("started_at", "desc"),
    filters_supported=["date_from", "date_to"],
    requires_warehouse=False,
)
def build_workflow_execution_logs(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            AutomationExecution.started_at.label("started_at"),
            AutomationExecution.rule_name.label("rule_name"),
            AutomationExecution.status.label("status"),
            AutomationExecution.message.label("message"),
        )
        .where(AutomationExecution.tenant_id == ctx.tenant_id)
    )
    if filters.date_from:
        stmt = stmt.where(func.date(AutomationExecution.started_at) >= filters.date_from)
    if filters.date_to:
        stmt = stmt.where(func.date(AutomationExecution.started_at) <= filters.date_to)
    return stmt, {"started_at": AutomationExecution.started_at}
