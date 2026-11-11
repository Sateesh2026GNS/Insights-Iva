"""Allowlisted datasets for custom report builder — never accepts raw SQL."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Literal

from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sqlalchemy.sql import Select

from app.models.inventory import InventoryItem, StockLevel, Supplier, Warehouse
from app.models.procurement import PurchaseOrder, VendorBill
from app.models.sales import Customer, Invoice, Payment, SalesOrder
from app.models.user import User
from app.services.reports.context import ReportBuildContext
from app.services.reports.filters import ReportFilters

AggOp = Literal["sum", "count", "avg", "min", "max", "none"]
FilterOp = Literal["eq", "neq", "gt", "gte", "lt", "lte", "contains", "in"]


@dataclass(frozen=True)
class DatasetColumn:
    key: str
    label: str
    type: str = "text"
    aggregatable: bool = False
    filterable: bool = True
    groupable: bool = True
    sensitive: bool = False


@dataclass(frozen=True)
class DatasetDefinition:
    key: str
    label: str
    category: str
    required_permission: str
    allowed_roles: tuple[str, ...]
    columns: tuple[DatasetColumn, ...]
    builder: Callable[[ReportBuildContext, ReportFilters], tuple[Select, dict[str, Any]]]


def _sales_orders(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            SalesOrder.order_number.label("order_number"),
            SalesOrder.order_date.label("order_date"),
            Customer.name.label("customer"),
            SalesOrder.status.label("status"),
            SalesOrder.total_amount.label("total_amount"),
        )
        .join(Customer, SalesOrder.customer_id == Customer.id)
        .where(SalesOrder.tenant_id == ctx.tenant_id)
    )
    if filters.date_from is not None:
        stmt = stmt.where(SalesOrder.order_date >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(SalesOrder.order_date <= filters.date_to)
    if filters.status:
        stmt = stmt.where(SalesOrder.status == filters.status)
    return stmt, {
        "order_number": SalesOrder.order_number,
        "order_date": SalesOrder.order_date,
        "customer": Customer.name,
        "status": SalesOrder.status,
        "total_amount": SalesOrder.total_amount,
    }


def _invoices(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Invoice.invoice_number.label("invoice_number"),
            Invoice.issue_date.label("issue_date"),
            Customer.name.label("customer"),
            Invoice.invoice_status.label("status"),
            Invoice.grand_total.label("grand_total"),
            Invoice.amount_paid.label("amount_paid"),
        )
        .join(Customer, Invoice.customer_id == Customer.id)
        .where(Invoice.tenant_id == ctx.tenant_id)
    )
    if filters.date_from is not None:
        stmt = stmt.where(Invoice.issue_date >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(Invoice.issue_date <= filters.date_to)
    return stmt, {
        "invoice_number": Invoice.invoice_number,
        "issue_date": Invoice.issue_date,
        "customer": Customer.name,
        "status": Invoice.invoice_status,
        "grand_total": Invoice.grand_total,
        "amount_paid": Invoice.amount_paid,
    }


def _payments(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            Payment.payment_date.label("payment_date"),
            Invoice.invoice_number.label("invoice_number"),
            Payment.amount.label("amount"),
            Payment.method.label("method"),
        )
        .join(Invoice, Payment.invoice_id == Invoice.id)
        .where(Payment.tenant_id == ctx.tenant_id)
    )
    if filters.date_from is not None:
        stmt = stmt.where(Payment.payment_date >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(Payment.payment_date <= filters.date_to)
    return stmt, {
        "payment_date": Payment.payment_date,
        "invoice_number": Invoice.invoice_number,
        "amount": Payment.amount,
        "method": Payment.method,
    }


def _purchase_orders(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            PurchaseOrder.po_number.label("po_number"),
            PurchaseOrder.order_date.label("order_date"),
            Supplier.name.label("supplier"),
            PurchaseOrder.status.label("status"),
            PurchaseOrder.total_amount.label("total_amount"),
        )
        .join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
        .where(PurchaseOrder.tenant_id == ctx.tenant_id)
    )
    if filters.date_from is not None:
        stmt = stmt.where(PurchaseOrder.order_date >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(PurchaseOrder.order_date <= filters.date_to)
    if filters.status:
        stmt = stmt.where(PurchaseOrder.status == filters.status)
    return stmt, {
        "po_number": PurchaseOrder.po_number,
        "order_date": PurchaseOrder.order_date,
        "supplier": Supplier.name,
        "status": PurchaseOrder.status,
        "total_amount": PurchaseOrder.total_amount,
    }


def _vendor_bills(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            VendorBill.bill_number.label("bill_number"),
            VendorBill.bill_date.label("bill_date"),
            Supplier.name.label("supplier"),
            VendorBill.status.label("status"),
            VendorBill.amount.label("total_amount"),
        )
        .join(Supplier, VendorBill.supplier_id == Supplier.id)
        .where(VendorBill.tenant_id == ctx.tenant_id)
    )
    if filters.date_from is not None:
        stmt = stmt.where(VendorBill.bill_date >= filters.date_from)
    if filters.date_to is not None:
        stmt = stmt.where(VendorBill.bill_date <= filters.date_to)
    return stmt, {
        "bill_number": VendorBill.bill_number,
        "bill_date": VendorBill.bill_date,
        "supplier": Supplier.name,
        "status": VendorBill.status,
        "total_amount": VendorBill.amount,
    }


def _stock_levels(ctx: ReportBuildContext, filters: ReportFilters) -> tuple[Select, dict]:
    stmt = (
        select(
            InventoryItem.sku.label("sku"),
            InventoryItem.name.label("item_name"),
            InventoryItem.category.label("category"),
            StockLevel.quantity.label("qty_on_hand"),
            InventoryItem.unit_cost.label("unit_cost"),
        )
        .join(InventoryItem, StockLevel.item_id == InventoryItem.id)
        .join(Warehouse, StockLevel.warehouse_id == Warehouse.id)
        .where(Warehouse.tenant_id == ctx.tenant_id, InventoryItem.tenant_id == ctx.tenant_id)
    )
    if ctx.warehouse_ids:
        stmt = stmt.where(StockLevel.warehouse_id.in_(ctx.warehouse_ids))
    return stmt, {
        "sku": InventoryItem.sku,
        "item_name": InventoryItem.name,
        "category": InventoryItem.category,
        "qty_on_hand": StockLevel.quantity,
        "unit_cost": InventoryItem.unit_cost,
    }


DATASET_REGISTRY: dict[str, DatasetDefinition] = {
    "sales_orders": DatasetDefinition(
        key="sales_orders",
        label="Sales Orders",
        category="Sales",
        required_permission="sales",
        allowed_roles=("Admin", "Sales Manager"),
        columns=(
            DatasetColumn("order_number", "Order #"),
            DatasetColumn("order_date", "Order date", "date"),
            DatasetColumn("customer", "Customer"),
            DatasetColumn("status", "Status", "badge"),
            DatasetColumn("total_amount", "Amount", "currency", aggregatable=True, groupable=False),
        ),
        builder=_sales_orders,
    ),
    "invoices": DatasetDefinition(
        key="invoices",
        label="Invoices",
        category="Receivables",
        required_permission="accounts",
        allowed_roles=("Admin", "Accountant", "Sales Manager"),
        columns=(
            DatasetColumn("invoice_number", "Invoice #"),
            DatasetColumn("issue_date", "Issue date", "date"),
            DatasetColumn("customer", "Customer"),
            DatasetColumn("status", "Status", "badge"),
            DatasetColumn("grand_total", "Grand total", "currency", aggregatable=True, groupable=False),
            DatasetColumn("amount_paid", "Amount paid", "currency", aggregatable=True, groupable=False),
        ),
        builder=_invoices,
    ),
    "payments_received": DatasetDefinition(
        key="payments_received",
        label="Payments Received",
        category="Payments Received",
        required_permission="accounts",
        allowed_roles=("Admin", "Accountant"),
        columns=(
            DatasetColumn("payment_date", "Payment date", "date"),
            DatasetColumn("invoice_number", "Invoice #"),
            DatasetColumn("amount", "Amount", "currency", aggregatable=True, groupable=False),
            DatasetColumn("method", "Method"),
        ),
        builder=_payments,
    ),
    "purchase_orders": DatasetDefinition(
        key="purchase_orders",
        label="Purchase Orders",
        category="Payables",
        required_permission="procurement",
        allowed_roles=("Admin", "Purchase Manager", "Store Manager"),
        columns=(
            DatasetColumn("po_number", "PO #"),
            DatasetColumn("order_date", "Order date", "date"),
            DatasetColumn("supplier", "Vendor"),
            DatasetColumn("status", "Status", "badge"),
            DatasetColumn("total_amount", "Amount", "currency", aggregatable=True, groupable=False),
        ),
        builder=_purchase_orders,
    ),
    "vendor_bills": DatasetDefinition(
        key="vendor_bills",
        label="Vendor Bills",
        category="Payables",
        required_permission="procurement",
        allowed_roles=("Admin", "Purchase Manager", "Accountant"),
        columns=(
            DatasetColumn("bill_number", "Bill #"),
            DatasetColumn("bill_date", "Bill date", "date"),
            DatasetColumn("supplier", "Vendor"),
            DatasetColumn("status", "Status", "badge"),
            DatasetColumn("total_amount", "Amount", "currency", aggregatable=True, groupable=False),
        ),
        builder=_vendor_bills,
    ),
    "stock_levels": DatasetDefinition(
        key="stock_levels",
        label="Stock Levels",
        category="Inventory",
        required_permission="inventory",
        allowed_roles=("Admin", "Store Manager", "Production Manager"),
        columns=(
            DatasetColumn("sku", "SKU"),
            DatasetColumn("item_name", "Item"),
            DatasetColumn("category", "Category"),
            DatasetColumn("qty_on_hand", "Qty on hand", "qty", aggregatable=True, groupable=False),
            DatasetColumn("unit_cost", "Unit cost", "currency", aggregatable=True, groupable=False, sensitive=True),
        ),
        builder=_stock_levels,
    ),
}


def list_datasets_for_user(user: User) -> list[dict[str, Any]]:
    from app.core.permissions import get_role_names, user_has_permission, user_is_admin

    roles = {n.strip() for n in get_role_names(user) if n}
    out = []
    for ds in DATASET_REGISTRY.values():
        if not user_is_admin(user):
            if not roles.intersection(ds.allowed_roles):
                continue
            if not user_has_permission(user, ds.required_permission):
                continue
        out.append(
            {
                "key": ds.key,
                "label": ds.label,
                "category": ds.category,
                "columns": [
                    {
                        "key": c.key,
                        "label": c.label,
                        "type": c.type,
                        "aggregatable": c.aggregatable,
                        "filterable": c.filterable,
                        "groupable": c.groupable,
                        "sensitive": c.sensitive,
                    }
                    for c in ds.columns
                    if not c.sensitive or user_is_admin(user) or user_has_permission(user, "accounts")
                ],
            }
        )
    return out


def get_dataset(key: str) -> DatasetDefinition | None:
    return DATASET_REGISTRY.get(key)


def apply_aggregation(
    stmt: Select,
    column_map: dict[str, Any],
    *,
    selected: list[str],
    group_by: list[str],
    aggregations: dict[str, str],
) -> Select:
    """Rebuild select with allowlisted group-by + aggregations."""
    if not group_by and not aggregations:
        # Project selected columns only.
        cols = [column_map[k].label(k) for k in selected if k in column_map]
        return stmt.with_only_columns(*cols) if cols else stmt

    select_cols = []
    group_cols = []
    for key in group_by:
        if key not in column_map or key not in selected:
            continue
        select_cols.append(column_map[key].label(key))
        group_cols.append(column_map[key])
    for key, op in aggregations.items():
        if key not in column_map or key not in selected:
            continue
        expr = column_map[key]
        op_l = (op or "sum").lower()
        if op_l == "count":
            select_cols.append(func.count(expr).label(key))
        elif op_l == "avg":
            select_cols.append(func.avg(expr).label(key))
        elif op_l == "min":
            select_cols.append(func.min(expr).label(key))
        elif op_l == "max":
            select_cols.append(func.max(expr).label(key))
        else:
            select_cols.append(func.sum(expr).label(key))
    if not select_cols:
        return stmt
    rebuilt = stmt.with_only_columns(*select_cols)
    if group_cols:
        rebuilt = rebuilt.group_by(*group_cols)
    return rebuilt
