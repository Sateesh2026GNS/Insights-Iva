"""System Reports Center catalog — 56 SMRT ERP reports (single source of truth)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

DataStatus = Literal["implemented", "partial", "gap"]

_ADMIN = ("Admin",)
_SALES = ("Admin", "Sales Manager")
_INVENTORY = ("Admin", "Store Manager", "Production Manager")
_VALUATION = ("Admin", "Store Manager", "Accountant")
_RECEIVABLES = ("Admin", "Accountant", "Sales Manager")
_PAYMENTS_IN = ("Admin", "Accountant")
_PAYABLES = ("Admin", "Purchase Manager", "Accountant")
_PURCHASES = ("Admin", "Purchase Manager", "Store Manager")
_ACTIVITY = ("Admin",)
_AUTOMATION = ("Admin",)


@dataclass(frozen=True)
class SystemReportEntry:
    slug: str
    title: str
    category: str
    description: str
    allowed_roles: tuple[str, ...]
    required_permission: str
    handler_key: str | None
    data_status: DataStatus


def _entry(
    slug: str,
    title: str,
    category: str,
    *,
    roles: tuple[str, ...],
    permission: str = "reports:view",
    handler_key: str | None = None,
    data_status: DataStatus = "gap",
    description: str = "",
) -> SystemReportEntry:
    return SystemReportEntry(
        slug=slug,
        title=title,
        category=category,
        description=description or f"System report: {title}.",
        allowed_roles=roles,
        required_permission=permission,
        handler_key=handler_key,
        data_status=data_status,
    )


SYSTEM_REPORTS: tuple[SystemReportEntry, ...] = (
    # Sales (9)
    _entry("sales-by-customer", "Sales by Customer", "Sales", roles=_SALES, handler_key="sales_by_customer", data_status="implemented"),
    _entry("sales-by-item", "Sales by Item", "Sales", roles=_SALES, handler_key="sales_by_item", data_status="implemented"),
    _entry("order-fulfillment-by-item", "Order Fulfillment By Item", "Sales", roles=_SALES, handler_key="order_fulfillment_by_item", data_status="partial"),
    _entry("sales-return-history", "Sales Return History", "Sales", roles=_SALES, data_status="gap"),
    _entry("sales-by-category", "Sales by Category", "Sales", roles=_SALES, handler_key="sales_by_category", data_status="implemented"),
    _entry("sales-by-salesperson", "Sales by Salesperson", "Sales", roles=_SALES, handler_key="sales_by_salesperson", data_status="partial"),
    _entry("sales-summary", "Sales Summary", "Sales", roles=_SALES, handler_key="sales_summary", data_status="implemented"),
    _entry("profit-by-item", "Profit By Item", "Sales", roles=_SALES, data_status="gap"),
    _entry("sales-channel-integrations-sync-summary", "Sales Channel Integrations Sync Summary", "Sales", roles=_SALES, data_status="gap"),
    # Inventory (10)
    _entry("inventory-summary", "Inventory Summary", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="current_stock", data_status="implemented"),
    _entry("committed-stock-details", "Committed Stock Details", "Inventory", roles=_INVENTORY, permission="inventory", data_status="gap"),
    _entry("inventory-aging-summary", "Inventory Aging Summary", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="inventory_ageing", data_status="implemented"),
    _entry("stock-summary", "Stock Summary", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="current_stock", data_status="implemented"),
    _entry("inventory-adjustment-summary", "Inventory Adjustment Summary", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="stock_adjustment_log", data_status="implemented"),
    _entry("inventory-adjustment-details", "Inventory Adjustment Details", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="stock_adjustment_log", data_status="implemented"),
    _entry("packing-history", "Packing History", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="packing_history", data_status="partial"),
    _entry("shipment-details", "Shipment Details", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="shipment_details", data_status="implemented"),
    _entry("shipment-by-item", "Shipment By Item", "Inventory", roles=_INVENTORY, permission="inventory", data_status="gap"),
    _entry("inventory-turnover-by-quantity", "Inventory Turnover By Quantity", "Inventory", roles=_INVENTORY, permission="inventory", handler_key="stock_ledger", data_status="partial"),
    # Inventory Valuation (5)
    _entry("inventory-valuation-summary", "Inventory Valuation Summary", "Inventory Valuation", roles=_VALUATION, permission="inventory", handler_key="current_stock", data_status="implemented"),
    _entry("fifo-cost-lot-tracking", "FIFO Cost Lot Tracking", "Inventory Valuation", roles=_VALUATION, permission="inventory", data_status="gap"),
    _entry("abc-classification", "ABC Classification", "Inventory Valuation", roles=_VALUATION, permission="inventory", data_status="gap"),
    _entry("inventory-turnover-by-amount", "Inventory Turnover By Amount", "Inventory Valuation", roles=_VALUATION, permission="inventory", handler_key="stock_ledger", data_status="partial"),
    _entry("weighted-average-cost-summary", "Weighted Average Cost (Moving Average) Summary", "Inventory Valuation", roles=_VALUATION, permission="inventory", handler_key="current_stock", data_status="implemented"),
    # Receivables (6)
    _entry("invoice-details", "Invoice Details", "Receivables", roles=_RECEIVABLES, permission="sales", handler_key="invoice_details", data_status="implemented"),
    _entry("sales-order-details", "Sales Order Details", "Receivables", roles=_RECEIVABLES, permission="sales", handler_key="sales_order_details", data_status="implemented"),
    _entry("delivery-challan-details", "Delivery Challan Details", "Receivables", roles=_RECEIVABLES, permission="sales", data_status="gap"),
    _entry("customer-balance-summary", "Customer Balance Summary", "Receivables", roles=_RECEIVABLES, permission="accounts", handler_key="customer_balance_summary", data_status="partial"),
    _entry("receivable-summary", "Receivable Summary", "Receivables", roles=_RECEIVABLES, permission="accounts", handler_key="receivable_summary", data_status="partial"),
    _entry("receivable-details", "Receivable Details", "Receivables", roles=_RECEIVABLES, permission="accounts", handler_key="invoice_details", data_status="partial"),
    # Payments Received (3)
    _entry("payments-received", "Payments Received", "Payments Received", roles=_PAYMENTS_IN, permission="accounts", handler_key="payments_received", data_status="implemented"),
    _entry("credit-note-details", "Credit Note Details", "Payments Received", roles=_PAYMENTS_IN, permission="sales", data_status="gap"),
    _entry("refund-history", "Refund History", "Payments Received", roles=_PAYMENTS_IN, permission="accounts", data_status="gap"),
    # Payables (9)
    _entry("vendor-balance-summary", "Vendor Balance Summary", "Payables", roles=_PAYABLES, permission="procurement", handler_key="vendor_balance_summary", data_status="partial"),
    _entry("bill-details", "Bill Details", "Payables", roles=_PAYABLES, permission="procurement", handler_key="bill_details", data_status="implemented"),
    _entry("vendor-credit-details", "Vendor Credit Details", "Payables", roles=_PAYABLES, permission="procurement", data_status="gap"),
    _entry("payments-made", "Payments Made", "Payables", roles=_PAYABLES, permission="procurement", handler_key="payments_made", data_status="implemented"),
    _entry("purchase-order-details", "Purchase Order Details", "Payables", roles=_PAYABLES, permission="procurement", handler_key="purchase_order_details", data_status="implemented"),
    _entry("purchase-orders-by-vendor", "Purchase Orders by Vendor", "Payables", roles=_PAYABLES, permission="procurement", handler_key="purchase_orders_by_vendor", data_status="implemented"),
    _entry("purchase-order-by-item", "Purchase Order By Item", "Payables", roles=_PAYABLES, permission="procurement", handler_key="purchase_order_by_item", data_status="implemented"),
    _entry("payable-summary", "Payable Summary", "Payables", roles=_PAYABLES, permission="procurement", handler_key="payable_summary", data_status="partial"),
    _entry("payable-details", "Payable Details", "Payables", roles=_PAYABLES, permission="procurement", handler_key="bill_details", data_status="partial"),
    # Purchases (5)
    _entry("active-purchase-orders-report", "Active Purchase Orders Report", "Purchases", roles=_PURCHASES, permission="procurement", handler_key="pending_grn", data_status="implemented"),
    _entry("purchases-by-item", "Purchases by Item", "Purchases", roles=_PURCHASES, permission="procurement", handler_key="grn_register", data_status="partial"),
    _entry("purchases-by-category", "Purchases by Category", "Purchases", roles=_PURCHASES, permission="procurement", data_status="gap"),
    _entry("receives-history", "Receives History", "Purchases", roles=_PURCHASES, permission="procurement", handler_key="grn_register", data_status="implemented"),
    _entry("receives-history-by-item", "Receives History By Item", "Purchases", roles=_PURCHASES, permission="procurement", handler_key="grn_register", data_status="partial"),
    # Activity (6)
    _entry("system-mails", "System Mails", "Activity", roles=_ACTIVITY, permission="admin", data_status="gap"),
    _entry("activity-logs-audit-trail", "Activity Logs & Audit Trail", "Activity", roles=_ACTIVITY, permission="admin", handler_key="activity_logs_audit_trail", data_status="implemented"),
    _entry("portal-activities", "Portal Activities", "Activity", roles=_ACTIVITY, permission="admin", data_status="gap"),
    _entry("customer-reviews", "Customer Reviews", "Activity", roles=_ACTIVITY, permission="admin", data_status="gap"),
    _entry("api-usage", "API Usage", "Activity", roles=_ACTIVITY, permission="admin", data_status="gap"),
    _entry("pending-inventory-valuations", "Pending Inventory Valuations", "Activity", roles=_ACTIVITY, permission="admin", data_status="gap"),
    # Automation (3)
    _entry("scheduled-date-based-workflow-rules", "Scheduled Date Based Workflow Rules", "Automation", roles=_AUTOMATION, permission="admin", data_status="gap"),
    _entry("scheduled-time-based-workflow-actions", "Scheduled Time Based Workflow Actions", "Automation", roles=_AUTOMATION, permission="admin", data_status="gap"),
    _entry("workflow-execution-logs", "Workflow Execution Logs", "Automation", roles=_AUTOMATION, permission="admin", handler_key="workflow_execution_logs", data_status="implemented"),
)

SYSTEM_REPORTS_BY_SLUG = {e.slug: e for e in SYSTEM_REPORTS}

EXPECTED_CATEGORY_COUNTS = {
    "Sales": 9,
    "Inventory": 10,
    "Inventory Valuation": 5,
    "Receivables": 6,
    "Payments Received": 3,
    "Payables": 9,
    "Purchases": 5,
    "Activity": 6,
    "Automation": 3,
}
