"""Sales Manager agent tools — delegate to sales_service."""

from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.sales import Invoice, SalesOrder
from app.schemas.sales import QuotationCreate
from app.services.agent.context import AgentContext
from app.services.agent.tool_models import ConfirmationRequired, ToolResultBase
from app.services.sales_service import (
    create_quotation,
    get_customer,
    list_invoices,
    list_payments,
    list_quotations,
    list_sales_orders,
    update_sales_order_status,
)

SALES_SOURCE_KEY = "sales_service"


class SalesOrderResult(ToolResultBase):
    pass


class QuotationResult(ToolResultBase):
    pass


class CustomerHistoryResult(ToolResultBase):
    pass


class InvoiceStatusResult(ToolResultBase):
    pass


class GetSalesOrdersInput(BaseModel):
    status: str | None = None
    customer_query: str | None = None
    date_from: date | None = None
    date_to: date | None = None


class GetQuotationsInput(BaseModel):
    status: str | None = None
    customer_query: str | None = None


class GetCustomerHistoryInput(BaseModel):
    customer_id: int = Field(gt=0)


class GetInvoiceStatusInput(BaseModel):
    invoice_no: str


class CreateQuotationInput(BaseModel):
    customer_id: int = Field(gt=0)
    items: list[dict[str, Any]] = Field(default_factory=list)
    note: str | None = None


class UpdateOrderStatusInput(BaseModel):
    order_id: int = Field(gt=0)
    new_status: str


_SO_STATUS_TRANSITIONS: dict[str, frozenset[str]] = {
    "draft": frozenset({"pending", "confirmed", "cancelled", "on_hold"}),
    "pending": frozenset({"confirmed", "cancelled", "on_hold", "draft"}),
    "confirmed": frozenset({"on_hold", "cancelled", "delivered"}),
    "approved": frozenset({"on_hold", "cancelled", "confirmed"}),
    "on_hold": frozenset({"pending", "confirmed", "cancelled", "draft"}),
    "cancelled": frozenset({"draft"}),
    "delivered": frozenset(),
    "rejected": frozenset({"draft", "cancelled"}),
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _sales_columns() -> list[dict[str, Any]]:
    return [
        {"key": "order_number", "label": "Order", "type": "text"},
        {"key": "customer_name", "label": "Customer", "type": "text"},
        {"key": "status", "label": "Status", "type": "text"},
        {"key": "order_date", "label": "Date", "type": "date"},
        {"key": "total_amount", "label": "Amount", "type": "currency"},
    ]


def _quote_columns() -> list[dict[str, Any]]:
    return [
        {"key": "quote_number", "label": "Quote", "type": "text"},
        {"key": "customer_name", "label": "Customer", "type": "text"},
        {"key": "status", "label": "Status", "type": "text"},
        {"key": "quote_date", "label": "Date", "type": "date"},
        {"key": "total_amount", "label": "Amount", "type": "currency"},
    ]


def _filter_customer_query(rows: list[dict[str, Any]], customer_query: str | None) -> list[dict[str, Any]]:
    q = (customer_query or "").strip().lower()
    if not q:
        return rows
    return [r for r in rows if q in str(r.get("customer_name") or "").lower()]


def _filter_date_range(
    rows: list[dict[str, Any]], date_from: date | None, date_to: date | None, key: str
) -> list[dict[str, Any]]:
    out = rows
    if date_from:
        out = [r for r in out if r.get(key) and str(r[key]) >= str(date_from)]
    if date_to:
        out = [r for r in out if r.get(key) and str(r[key]) <= str(date_to)]
    return out


def get_sales_orders(db: Session, ctx: AgentContext, inp: GetSalesOrdersInput) -> SalesOrderResult:
    orders = list_sales_orders(db, ctx.tenant_id, status=inp.status)
    rows = []
    for o in orders:
        rows.append(
            {
                "id": o.id,
                "order_number": o.order_number,
                "customer_name": o.customer_name or (o.customer.name if o.customer else None),
                "status": o.status,
                "order_date": o.order_date.isoformat() if o.order_date else None,
                "total_amount": float(o.total_amount or 0),
                "workflow_status": o.workflow_status,
            }
        )
    rows = _filter_customer_query(rows, inp.customer_query)
    rows = _filter_date_range(rows, inp.date_from, inp.date_to, "order_date")
    total = len(rows)
    return SalesOrderResult(
        rows=rows[:200],
        truncated=total > 200,
        total_count=total,
        generated_at=_now_iso(),
        source_report_key=SALES_SOURCE_KEY,
        report_title="Sales orders",
        columns=_sales_columns(),
    )


def get_quotations(db: Session, ctx: AgentContext, inp: GetQuotationsInput) -> QuotationResult:
    quotes = list_quotations(db, ctx.tenant_id, status=inp.status)
    rows = []
    for q in quotes:
        rows.append(
            {
                "id": q.id,
                "quote_number": q.quote_number,
                "customer_name": q.customer_name or (q.customer.name if q.customer else None),
                "status": q.status,
                "quote_date": q.quote_date.isoformat() if q.quote_date else None,
                "total_amount": float(q.total_amount or 0),
            }
        )
    rows = _filter_customer_query(rows, inp.customer_query)
    total = len(rows)
    return QuotationResult(
        rows=rows[:200],
        truncated=total > 200,
        total_count=total,
        generated_at=_now_iso(),
        source_report_key=SALES_SOURCE_KEY,
        report_title="Quotations",
        columns=_quote_columns(),
    )


def get_customer_history(
    db: Session, ctx: AgentContext, inp: GetCustomerHistoryInput
) -> CustomerHistoryResult:
    customer = get_customer(db, ctx.tenant_id, inp.customer_id)
    if not customer:
        return CustomerHistoryResult(
            rows=[],
            total_count=0,
            generated_at=_now_iso(),
            source_report_key=SALES_SOURCE_KEY,
            report_title="Customer history",
            error="Customer not found.",
        )
    orders = [
        o
        for o in list_sales_orders(db, ctx.tenant_id)
        if o.customer_id == inp.customer_id
    ]
    invoices = [i for i in list_invoices(db, ctx.tenant_id) if i.customer_id == inp.customer_id]
    payments = list_payments(db, ctx.tenant_id)
    inv_ids = {i.id for i in invoices}
    payments = [p for p in payments if p.invoice_id in inv_ids]

    rows: list[dict[str, Any]] = []
    for o in orders[:50]:
        rows.append(
            {
                "record_type": "sales_order",
                "reference": o.order_number,
                "status": o.status,
                "amount": float(o.total_amount or 0),
                "date": o.order_date.isoformat() if o.order_date else None,
            }
        )
    for inv in invoices[:50]:
        paid = float(inv.amount_paid or 0)
        grand = float(inv.grand_total or 0)
        rows.append(
            {
                "record_type": "invoice",
                "reference": inv.invoice_number,
                "status": inv.status,
                "amount": grand,
                "payment_status": "paid" if paid >= grand and grand > 0 else ("partial" if paid > 0 else "unpaid"),
                "date": inv.issue_date.isoformat() if inv.issue_date else None,
            }
        )
    for p in payments[:50]:
        rows.append(
            {
                "record_type": "payment",
                "reference": f"PMT-{p.id}",
                "status": p.status or "recorded",
                "amount": float(p.amount or 0),
                "date": p.payment_date.isoformat() if p.payment_date else None,
            }
        )
    return CustomerHistoryResult(
        rows=rows,
        truncated=len(rows) > 200,
        total_count=len(rows),
        generated_at=_now_iso(),
        source_report_key=SALES_SOURCE_KEY,
        report_title=f"Customer history — {customer.name}",
        columns=[
            {"key": "record_type", "label": "Type", "type": "text"},
            {"key": "reference", "label": "Reference", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "payment_status", "label": "Payment", "type": "text"},
            {"key": "amount", "label": "Amount", "type": "currency"},
            {"key": "date", "label": "Date", "type": "date"},
        ],
    )


def get_invoice_status(db: Session, ctx: AgentContext, inp: GetInvoiceStatusInput) -> InvoiceStatusResult:
    inv_no = (inp.invoice_no or "").strip()
    if not inv_no:
        return InvoiceStatusResult(
            rows=[],
            generated_at=_now_iso(),
            source_report_key=SALES_SOURCE_KEY,
            report_title="Invoice status",
            error="invoice_no is required.",
        )
    inv = db.scalars(
        select(Invoice).where(
            Invoice.tenant_id == ctx.tenant_id,
            Invoice.invoice_number == inv_no,
        )
    ).first()
    if not inv:
        return InvoiceStatusResult(
            rows=[],
            generated_at=_now_iso(),
            source_report_key=SALES_SOURCE_KEY,
            report_title="Invoice status",
            error=f"No invoice found for '{inv_no}'.",
        )
    paid = float(inv.amount_paid or 0)
    grand = float(inv.grand_total or 0)
    row = {
        "invoice_number": inv.invoice_number,
        "status": inv.status,
        "customer_id": inv.customer_id,
        "grand_total": grand,
        "amount_paid": paid,
        "balance": max(0.0, grand - paid),
        "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
    }
    return InvoiceStatusResult(
        rows=[row],
        total_count=1,
        generated_at=_now_iso(),
        source_report_key=SALES_SOURCE_KEY,
        report_title="Invoice status",
        columns=[
            {"key": "invoice_number", "label": "Invoice", "type": "text"},
            {"key": "status", "label": "Status", "type": "text"},
            {"key": "grand_total", "label": "Total", "type": "currency"},
            {"key": "amount_paid", "label": "Paid", "type": "currency"},
            {"key": "balance", "label": "Balance", "type": "currency"},
        ],
    )


def _quotation_total_from_items(items: list[dict[str, Any]]) -> float:
    total = 0.0
    for it in items or []:
        try:
            qty = float(it.get("qty") or it.get("quantity") or 0)
            price = float(it.get("unit_price") or it.get("price") or 0)
            total += qty * price
        except (TypeError, ValueError):
            continue
    return total


def prepare_create_quotation(
    ctx: AgentContext, inp: CreateQuotationInput
) -> ConfirmationRequired | dict[str, str]:
    from app.core.config import get_settings

    if not get_settings().agent_write_tools_enabled:
        return {"error": "Write tools are not enabled for this environment."}
    total = _quotation_total_from_items(inp.items)
    summary = (
        f"Create quotation for customer {inp.customer_id} "
        f"({len(inp.items or [])} line(s), total ₹{total:,.2f}) — confirm?"
    )
    return ConfirmationRequired(
        summary=summary,
        tool_name="create_quotation",
        payload=inp.model_dump(mode="json"),
    )


def _validate_sales_order_status_transition(current: str, new: str) -> str | None:
    cur = (current or "draft").lower().strip()
    nxt = (new or "").lower().strip()
    if not nxt:
        return "new_status is required."
    if nxt == cur:
        return None
    allowed = _SO_STATUS_TRANSITIONS.get(cur)
    if allowed is None:
        return f"Unknown current status '{current}'."
    if nxt not in allowed:
        return (
            f"Cannot change order status from '{cur}' to '{nxt}'. "
            f"Allowed: {', '.join(sorted(allowed))}."
        )
    return None


def prepare_update_order_status(
    db: Session, ctx: AgentContext, inp: UpdateOrderStatusInput
) -> ConfirmationRequired | dict[str, str]:
    from app.core.config import get_settings

    if not get_settings().agent_write_tools_enabled:
        return {"error": "Write tools are not enabled for this environment."}
    order = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == inp.order_id,
            SalesOrder.tenant_id == ctx.tenant_id,
        )
    ).first()
    if not order:
        return {"error": "Sales order not found."}
    err = _validate_sales_order_status_transition(order.status or "", inp.new_status)
    if err:
        return {"error": err}
    summary = (
        f"Update order {order.order_number} status "
        f"from '{order.status}' to '{inp.new_status}' — confirm?"
    )
    return ConfirmationRequired(
        summary=summary,
        tool_name="update_order_status",
        payload=inp.model_dump(mode="json"),
    )


def execute_create_quotation(db: Session, ctx: AgentContext, payload: dict[str, Any]) -> dict[str, Any]:
    inp = CreateQuotationInput.model_validate(payload)
    import json as _json

    total = _quotation_total_from_items(inp.items)
    meta = {"items": inp.items, "agent_note": inp.note}
    quote = create_quotation(
        db,
        QuotationCreate(
            tenant_id=ctx.tenant_id,
            customer_id=inp.customer_id,
            notes=inp.note,
            total_amount=total,
            meta_json=_json.dumps(meta),
        ),
    )
    return {
        "kind": "quotation_created",
        "message": f"Quotation {quote.quote_number} created.",
        "reference": quote.quote_number,
        "quotation_id": quote.id,
    }


def execute_update_order_status(db: Session, ctx: AgentContext, payload: dict[str, Any]) -> dict[str, Any]:
    inp = UpdateOrderStatusInput.model_validate(payload)
    order = db.scalars(
        select(SalesOrder).where(
            SalesOrder.id == inp.order_id,
            SalesOrder.tenant_id == ctx.tenant_id,
        )
    ).first()
    if not order:
        return {"success": False, "error": "Sales order not found."}
    err = _validate_sales_order_status_transition(order.status or "", inp.new_status)
    if err:
        return {"success": False, "error": err}
    updated = update_sales_order_status(
        db,
        ctx.tenant_id,
        inp.order_id,
        inp.new_status,
        user=ctx.user,
    )
    if not updated:
        return {"success": False, "error": "Could not update order status."}
    return {
        "success": True,
        "message": f"Order {updated.order_number} is now '{updated.status}'.",
        "order_id": updated.id,
    }
