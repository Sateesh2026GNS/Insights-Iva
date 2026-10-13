"""Period-scoped financial dashboard payload for accounts work center UI."""

from __future__ import annotations

from calendar import monthrange
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models.accounts import Expense
from app.models.procurement import PurchaseOrder, VendorBill
from app.models.sales import Customer, Invoice, InvoiceItem, Payment
from app.services.accounts_work_center_service import _bank_accounts, _fiscal_year_label
from app.services.finance_extended_service import (
    _invoice_eligible_for_ar,
    get_ap_summary,
    get_ar_summary,
    list_ap_enriched,
)
from app.services.gst_report_service import get_gst_summary


def _parse_iso(d: str | None, fallback: date) -> date:
    if not d:
        return fallback
    try:
        return date.fromisoformat(str(d)[:10])
    except ValueError:
        return fallback


def _fy_start(today: date) -> date:
    y = today.year if today.month >= 4 else today.year - 1
    return date(y, 4, 1)


def _month_bounds(year: int, month: int) -> tuple[date, date]:
    last = monthrange(year, month)[1]
    return date(year, month, 1), date(year, month, last)


def _month_label(year: int, month: int) -> str:
    return date(year, month, 1).strftime("%b '%y")


def _aging_from_invoices(db: Session, tenant_id: int, today: date) -> dict:
    invs = [
        i
        for i in db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all()
        if _invoice_eligible_for_ar(i)
    ]
    buckets = {"current": 0.0, "1-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    total = 0.0
    for inv in invs:
        bal = float(inv.grand_total or 0) - float(inv.amount_paid or 0)
        if bal <= 0.01:
            continue
        total += bal
        due = inv.due_date or inv.issue_date or today
        if due >= today:
            buckets["current"] += bal
            continue
        days = (today - due).days
        if days <= 30:
            buckets["1-30"] += bal
        elif days <= 60:
            buckets["31-60"] += bal
        elif days <= 90:
            buckets["61-90"] += bal
        else:
            buckets["90+"] += bal
    return {"total": round(total, 2), "buckets": {k: round(v, 2) for k, v in buckets.items()}}


def _aging_from_payables(db: Session, tenant_id: int, today: date) -> dict:
    buckets = {"current": 0.0, "1-30": 0.0, "31-60": 0.0, "61-90": 0.0, "90+": 0.0}
    total = 0.0
    for r in list_ap_enriched(db, tenant_id):
        bal = float(r.balance or 0)
        if bal <= 0.01:
            continue
        total += bal
        due_raw = r.due_date
        if not due_raw:
            buckets["current"] += bal
            continue
        try:
            due = date.fromisoformat(str(due_raw)[:10])
        except ValueError:
            buckets["current"] += bal
            continue
        if due >= today:
            buckets["current"] += bal
            continue
        days = (today - due).days
        if days <= 30:
            buckets["1-30"] += bal
        elif days <= 60:
            buckets["31-60"] += bal
        elif days <= 90:
            buckets["61-90"] += bal
        else:
            buckets["90+"] += bal
    return {"total": round(total, 2), "buckets": {k: round(v, 2) for k, v in buckets.items()}}


def _sum_between(db, model, date_col, amount_col, tenant_id: int, dfrom: date, dto: date, *filters):
    return float(
        db.scalar(
            select(func.coalesce(func.sum(amount_col), 0)).where(
                model.tenant_id == tenant_id,
                date_col >= dfrom,
                date_col <= dto,
                *filters,
            )
        )
        or 0
    )


def _monthly_series(db: Session, tenant_id: int, dfrom: date, dto: date) -> list[dict]:
    series: list[dict] = []
    y, m = dfrom.year, dfrom.month
    while (y, m) <= (dto.year, dto.month):
        start, end = _month_bounds(y, m)
        clip_from, clip_to = max(start, dfrom), min(end, dto)
        sales = _sum_between(
            db,
            Invoice,
            Invoice.issue_date,
            Invoice.grand_total,
            tenant_id,
            clip_from,
            clip_to,
            Invoice.status != "draft",
            Invoice.invoice_status != "cancelled",
        )
        purchases = _sum_between(
            db,
            VendorBill,
            VendorBill.bill_date,
            VendorBill.amount,
            tenant_id,
            clip_from,
            clip_to,
            VendorBill.status != "cancelled",
        )
        if purchases <= 0:
            purchases = _sum_between(
                db,
                PurchaseOrder,
                PurchaseOrder.order_date,
                PurchaseOrder.total_amount,
                tenant_id,
                clip_from,
                clip_to,
                PurchaseOrder.status != "cancelled",
            )
        collections = float(
            db.scalar(
                select(func.coalesce(func.sum(Payment.amount), 0)).where(
                    Payment.tenant_id == tenant_id,
                    Payment.payment_date >= clip_from,
                    Payment.payment_date <= clip_to,
                )
            )
            or 0
        )
        expenses = _sum_between(db, Expense, Expense.expense_date, Expense.amount, tenant_id, clip_from, clip_to)
        series.append(
            {
                "month": _month_label(y, m),
                "sales": round(sales, 2),
                "purchases": round(purchases, 2),
                "collections": round(collections, 2),
                "expenses": round(expenses, 2),
            }
        )
        m += 1
        if m > 12:
            m, y = 1, y + 1
    return series


def _top_customers(db: Session, tenant_id: int, dfrom: date, dto: date, limit: int = 50) -> list[dict]:
    invs = db.scalars(
        select(Invoice)
        .options(joinedload(Invoice.customer))
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= dfrom,
            Invoice.issue_date <= dto,
            Invoice.status != "draft",
            Invoice.invoice_status != "cancelled",
        )
    ).all()
    totals: dict[str, float] = {}
    for inv in invs:
        name = inv.customer.name if inv.customer else "—"
        totals[name] = totals.get(name, 0.0) + float(inv.grand_total or 0)
    return [{"name": n, "amount": round(a, 2)} for n, a in sorted(totals.items(), key=lambda x: -x[1])[:limit]]


def _top_products(db: Session, tenant_id: int, dfrom: date, dto: date, limit: int = 50) -> list[dict]:
    rows = db.execute(
        select(InvoiceItem.item_description, func.sum(InvoiceItem.amount).label("amt"))
        .join(Invoice, Invoice.id == InvoiceItem.invoice_id)
        .where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= dfrom,
            Invoice.issue_date <= dto,
            Invoice.status != "draft",
            Invoice.invoice_status != "cancelled",
        )
        .group_by(InvoiceItem.item_description)
        .order_by(func.sum(InvoiceItem.amount).desc())
        .limit(limit)
    ).all()
    return [{"name": r[0] or "—", "amount": round(float(r[1] or 0), 2)} for r in rows]


def _overdue_by_customer(db: Session, tenant_id: int, today: date, limit: int = 50) -> list[dict]:
    invs = db.scalars(
        select(Invoice)
        .options(joinedload(Invoice.customer))
        .where(Invoice.tenant_id == tenant_id)
    ).all()
    totals: dict[str, float] = {}
    for inv in invs:
        if not _invoice_eligible_for_ar(inv):
            continue
        bal = float(inv.grand_total or 0) - float(inv.amount_paid or 0)
        if bal <= 0.01:
            continue
        due = inv.due_date or inv.issue_date or today
        if due >= today:
            continue
        name = inv.customer.name if inv.customer else "—"
        totals[name] = totals.get(name, 0.0) + bal
    return [{"name": n, "amount": round(a, 2)} for n, a in sorted(totals.items(), key=lambda x: -x[1])[:limit]]


def _invoice_status_rows(db: Session, tenant_id: int, dfrom: date, dto: date, limit: int = 50) -> list[dict]:
    invs = db.scalars(
        select(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.issue_date >= dfrom,
            Invoice.issue_date <= dto,
            Invoice.status != "draft",
            Invoice.invoice_status != "cancelled",
        )
    ).all()
    totals: dict[str, float] = {}
    for inv in invs:
        key = (inv.payment_status or inv.status or "unpaid").strip().lower()
        label = key.replace("_", " ").title()
        totals[label] = totals.get(label, 0.0) + float(inv.grand_total or 0)
    return [{"name": n, "amount": round(a, 2)} for n, a in sorted(totals.items(), key=lambda x: -x[1])[:limit]]


def _collections_by_customer(db: Session, tenant_id: int, dfrom: date, dto: date, limit: int = 50) -> list[dict]:
    rows = db.execute(
        select(Customer.name, func.sum(Payment.amount).label("amt"))
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .join(Customer, Customer.id == Invoice.customer_id)
        .where(
            Payment.tenant_id == tenant_id,
            Payment.payment_date >= dfrom,
            Payment.payment_date <= dto,
        )
        .group_by(Customer.name)
        .order_by(func.sum(Payment.amount).desc())
        .limit(limit)
    ).all()
    out = [{"name": r[0] or "—", "amount": round(float(r[1] or 0), 2)} for r in rows]
    if out:
        return out
    orphan = db.scalar(
        select(func.coalesce(func.sum(Payment.amount), 0)).where(
            Payment.tenant_id == tenant_id,
            Payment.payment_date >= dfrom,
            Payment.payment_date <= dto,
            Payment.invoice_id.is_(None),
        )
    )
    if orphan and float(orphan) > 0:
        return [{"name": "Unallocated receipts", "amount": round(float(orphan), 2)}]
    return []


def _cash_bank_split(accounts: list[dict]) -> tuple[float, float]:
    bank = cash = 0.0
    for acc in accounts:
        bal = float(acc.get("balance") or 0)
        code = str(acc.get("code") or "").lower()
        name = str(acc.get("name") or "").lower()
        if code == "cash" or "cash" in name and "bank" not in name:
            cash += bal
        else:
            bank += bal
    return round(bank, 2), round(cash, 2)


def build_financial_dashboard_block(
    db: Session,
    tenant_id: int,
    date_from: str | None = None,
    date_to: str | None = None,
) -> dict:
    today = date.today()
    dto = _parse_iso(date_to, today)
    dfrom = _parse_iso(date_from, _fy_start(today))
    if dto < dfrom:
        dto = dfrom

    ar = get_ar_summary(db, tenant_id)
    ap = get_ap_summary(db, tenant_id)
    bank_accounts = _bank_accounts(db, tenant_id)
    bank_total, cash_total = _cash_bank_split(bank_accounts)

    recv_total = float(ar.total_receivables or 0)
    recv_overdue = float(ar.overdue or 0)
    recv_current = max(0.0, recv_total - recv_overdue)

    ap_rows = list_ap_enriched(db, tenant_id)
    pay_overdue = sum(float(r.balance or 0) for r in ap_rows if r.status == "overdue")
    pay_total = float(ap.outstanding_payables or 0)
    pay_current = max(0.0, pay_total - pay_overdue)

    gst_summary = get_gst_summary(db, tenant_id, dfrom, dto)
    gst_kpis = gst_summary.kpis

    series = _monthly_series(db, tenant_id, dfrom, dto)
    totals = {
        "sales": round(sum(p["sales"] for p in series), 2),
        "purchases": round(sum(p["purchases"] for p in series), 2),
        "collections": round(sum(p["collections"] for p in series), 2),
        "expenses": round(sum(p["expenses"] for p in series), 2),
    }

    needs: list[str] = []
    if recv_overdue > 0:
        needs.append(f"₹{recv_overdue:,.0f} in overdue receivables needs follow-up.")
    if pay_overdue > 0:
        needs.append(f"₹{pay_overdue:,.0f} in overdue payables.")
    if float(gst_kpis.net_gst_liability or 0) > 0:
        needs.append(f"GST net liability ₹{float(gst_kpis.net_gst_liability):,.0f} for this period.")

    return {
        "reporting_period": {"from": dfrom.isoformat(), "to": dto.isoformat(), "financial_year": _fiscal_year_label(today)},
        "overview": {
            "receivables": {"total": round(recv_total, 2), "current": round(recv_current, 2), "overdue": round(recv_overdue, 2)},
            "payables": {"total": round(pay_total, 2), "current": round(pay_current, 2), "overdue": round(pay_overdue, 2)},
            "cash_and_bank": {
                "total": round(bank_total + cash_total, 2),
                "bank": bank_total,
                "cash": cash_total,
                "account_count": len(bank_accounts),
            },
            "gst": {
                "net": round(float(gst_kpis.net_gst_liability or 0), 2),
                "collected": round(float(gst_kpis.output_tax or 0), 2),
                "paid": round(float(gst_kpis.input_tax_credit or 0), 2),
            },
        },
        "sales_purchases": {"totals": totals, "series": series},
        "aging": {
            "receivable": _aging_from_invoices(db, tenant_id, today),
            "payable": _aging_from_payables(db, tenant_id, today),
            "as_of": today.isoformat(),
        },
        "sales_breakdown": {
            "top_customers": _top_customers(db, tenant_id, dfrom, dto),
            "top_products": _top_products(db, tenant_id, dfrom, dto),
            "overdue": _overdue_by_customer(db, tenant_id, today),
            "invoice_status": _invoice_status_rows(db, tenant_id, dfrom, dto),
            "collections": _collections_by_customer(db, tenant_id, dfrom, dto),
        },
        "needs_attention": " ".join(needs),
    }
