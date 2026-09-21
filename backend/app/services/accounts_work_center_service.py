"""Consolidated Accounts work-control dashboard — reuses finance_extended summaries."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.accounts import Expense, GLAccount, JournalEntry
from app.models.procurement import SupplierPayment
from app.models.sales import Invoice
from app.schemas.finance_extended import AccountsWorkCenterRead
from sqlalchemy.orm import joinedload

from app.services.finance_extended_service import (
    _invoice_eligible_for_ar,
    get_ap_summary,
    get_ar_summary,
    get_gl_summary,
    get_payment_summary,
    list_ap_enriched,
    list_payments_enriched,
)
from app.services.gl_accounts_utils import list_cash_bank_accounts_for_dashboard
from app.services.gst_report_service import get_gst_summary, _default_period


def _receivable_rows(db: Session, tenant_id: int, today: date, limit: int = 12) -> list[dict]:
    invs = list(
        db.scalars(
            select(Invoice)
            .options(joinedload(Invoice.customer))
            .where(Invoice.tenant_id == tenant_id)
            .order_by(Invoice.issue_date.desc())
        ).all()
    )
    rows = []
    for inv in invs:
        if not _invoice_eligible_for_ar(inv):
            continue
        amt = float(inv.grand_total or 0)
        paid = float(inv.amount_paid or 0)
        bal = amt - paid
        if bal <= 0.01:
            continue
        ref = inv.due_date or inv.issue_date or today
        days_od = max(0, (today - ref).days) if bal > 0 else 0
        st = (inv.payment_status or "pending").lower()
        if st == "unpaid":
            st = "pending"
        if inv.due_date and inv.due_date < today and bal > 0:
            st = "overdue"
        if st == "partial":
            st = "partial"
        elif st not in ("pending", "paid", "partial", "overdue", "cancelled"):
            st = "pending"
        rows.append(
            {
                "id": inv.id,
                "invoice_number": inv.invoice_number or f"INV-{inv.id}",
                "customer_name": inv.customer.name if inv.customer else "—",
                "issue_date": inv.issue_date.isoformat() if inv.issue_date else None,
                "due_date": inv.due_date.isoformat() if inv.due_date else None,
                "amount": amt,
                "paid": paid,
                "balance": bal,
                "days_overdue": days_od,
                "status": st,
            }
        )
    rows.sort(key=lambda r: (r["days_overdue"], r["balance"]), reverse=True)
    return rows[:limit]


def _fiscal_year_label(today: date) -> str:
    start_year = today.year if today.month >= 4 else today.year - 1
    end_short = str(start_year + 1)[-2:]
    return f"{start_year}-{end_short}"


def _invoice_summary(db: Session, tenant_id: int, today: date) -> dict:
    draft = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id, Invoice.status == "draft"
            )
        )
        or 0
    )
    cancelled = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.invoice_status == "cancelled",
            )
        )
        or 0
    )
    paid = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.status != "draft",
                Invoice.invoice_status != "cancelled",
                Invoice.status != "cancelled",
                Invoice.payment_status == "paid",
            )
        )
        or 0
    )
    partial = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.status != "draft",
                Invoice.invoice_status != "cancelled",
                Invoice.status != "cancelled",
                Invoice.payment_status == "partial",
            )
        )
        or 0
    )
    sent = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.status != "draft",
                Invoice.invoice_status != "cancelled",
                Invoice.status != "cancelled",
                Invoice.payment_status == "unpaid",
            )
        )
        or 0
    )
    overdue = int(
        db.scalar(
            select(func.count(Invoice.id)).where(
                Invoice.tenant_id == tenant_id,
                Invoice.status != "draft",
                Invoice.invoice_status != "cancelled",
                Invoice.status != "cancelled",
                Invoice.due_date.isnot(None),
                Invoice.due_date < today,
                Invoice.amount_paid < Invoice.grand_total,
            )
        )
        or 0
    )
    return {
        "draft": draft,
        "sent": sent,
        "partially_paid": partial,
        "paid": paid,
        "overdue": overdue,
        "cancelled": cancelled,
    }


def _bank_accounts(db: Session, tenant_id: int) -> list[dict]:
    rows = list(
        db.scalars(
            select(GLAccount)
            .where(GLAccount.tenant_id == tenant_id)
            .order_by(GLAccount.code.asc(), GLAccount.id.asc())
        ).all()
    )
    return list_cash_bank_accounts_for_dashboard(rows)


def _gst_filing_due_label(today: date) -> str:
    """GSTR-3B is typically due on the 20th of the month following the tax period."""
    if today.month == 12:
        due = date(today.year + 1, 1, 20)
    else:
        due = date(today.year, today.month + 1, 20)
    return f"Due {due.day} {due.strftime('%b')}"


def _gst_period_kpi(db: Session, tenant_id: int, today: date) -> dict:
    period_from, period_to = _default_period()
    summary = get_gst_summary(db, tenant_id, period_from, period_to)
    return {
        "net_liability": float(summary.kpis.net_gst_liability or 0),
        "period_from": summary.period_from,
        "period_to": summary.period_to,
        "filing_due_label": _gst_filing_due_label(today),
    }


def _recent_activity(db: Session, tenant_id: int, today: date) -> list[dict]:
    items: list[dict] = []

    payments = list_payments_enriched(db, tenant_id)[:8]
    for p in payments:
        kind = "payment_received" if p.party_type == "customer" else "payment_made"
        items.append(
            {
                "kind": kind,
                "label": p.party_name or p.invoice or p.payment_number,
                "reference": p.payment_number,
                "amount": float(p.amount or 0),
                "date": p.payment_date,
                "status": p.status,
            }
        )

    journals = list(
        db.scalars(
            select(JournalEntry)
            .where(JournalEntry.tenant_id == tenant_id)
            .order_by(JournalEntry.entry_date.desc())
            .limit(5)
        ).all()
    )
    for je in journals:
        items.append(
            {
                "kind": "journal",
                "label": je.description or "Journal entry",
                "reference": je.entry_number or f"JE-{je.id}",
                "amount": None,
                "date": je.entry_date.isoformat() if je.entry_date else None,
                "status": je.status if hasattr(je, "status") else "posted",
            }
        )

    invs = list(
        db.scalars(
            select(Invoice)
            .where(Invoice.tenant_id == tenant_id, Invoice.status != "draft")
            .order_by(Invoice.issue_date.desc())
            .limit(5)
        ).all()
    )
    for inv in invs:
        items.append(
            {
                "kind": "invoice",
                "label": inv.invoice_number or f"INV-{inv.id}",
                "reference": inv.invoice_number,
                "amount": float(inv.grand_total or 0),
                "date": inv.issue_date.isoformat() if inv.issue_date else None,
                "status": inv.payment_status or inv.status,
            }
        )

    items.sort(key=lambda x: x.get("date") or "", reverse=True)
    return items[:15]


def get_accounts_work_center(db: Session, tenant_id: int) -> dict:
    today = date.today()
    ar_sum = get_ar_summary(db, tenant_id)
    ap_sum = get_ap_summary(db, tenant_id)
    pay_sum = get_payment_summary(db, tenant_id)
    gl_sum = get_gl_summary(db, tenant_id)
    cash_bank_accounts = _bank_accounts(db, tenant_id)
    cash_panel_total = sum(float(a.get("balance") or 0) for a in cash_bank_accounts)
    gst_kpi = _gst_period_kpi(db, tenant_id, today)

    payments_today_out = float(
        db.scalar(
            select(func.coalesce(func.sum(SupplierPayment.amount), 0)).where(
                SupplierPayment.tenant_id == tenant_id,
                SupplierPayment.payment_date == today,
            )
        )
        or 0
    )

    receivables = _receivable_rows(db, tenant_id, today)
    open_ar_overdue = [r for r in receivables if r.get("days_overdue", 0) > 0]

    ap_rows = list_ap_enriched(db, tenant_id)
    open_ap = [r for r in ap_rows if float(r.balance or 0) > 0.01]
    open_ap.sort(
        key=lambda r: (1 if r.status == "overdue" else 0, float(r.balance or 0)),
        reverse=True,
    )
    payables = [r.model_dump() for r in open_ap[:12]]

    overdue_ap_amount = sum(float(r.balance or 0) for r in ap_rows if r.status == "overdue")

    expense_mtd = float(
        db.scalar(
            select(func.coalesce(func.sum(Expense.amount), 0)).where(
                Expense.tenant_id == tenant_id,
                func.extract("month", Expense.expense_date) == today.month,
                func.extract("year", Expense.expense_date) == today.year,
            )
        )
        or 0
    )
    expense_count_mtd = int(
        db.scalar(
            select(func.count(Expense.id)).where(
                Expense.tenant_id == tenant_id,
                func.extract("month", Expense.expense_date) == today.month,
                func.extract("year", Expense.expense_date) == today.year,
            )
        )
        or 0
    )

    money_in = float(ar_sum.received_today or 0)
    money_out = payments_today_out
    net_cash_flow_today = money_in - money_out

    pending_work = [
        {
            "id": "overdue_receivables",
            "label": "Overdue receivables",
            "count": len(open_ar_overdue),
            "amount": float(ar_sum.overdue or 0),
            "href": "/finance/accounts-receivable?focus=overdue",
        },
        {
            "id": "overdue_payables",
            "label": "Overdue payables",
            "count": int(ap_sum.overdue_bills or 0),
            "amount": overdue_ap_amount,
            "href": "/accounts/accounts-payable?focus=overdue",
        },
        {
            "id": "pending_payments",
            "label": "Pending payments",
            "count": int(pay_sum.pending_payments or 0),
            "amount": None,
            "href": "/finance/payment-tracking?focus=pending",
        },
        {
            "id": "pending_collections",
            "label": "Pending collections",
            "count": int(ar_sum.credit_customers or 0),
            "amount": float(ar_sum.pending_collection or 0),
            "href": "/finance/accounts-receivable?focus=open",
        },
        {
            "id": "bank_reconciliation",
            "label": "Bank reconciliation",
            "count": None,
            "amount": None,
            "href": "/accounts/bank-reconciliation",
        },
    ]

    payload = AccountsWorkCenterRead(
        financial_year=_fiscal_year_label(today),
        as_of_date=today.isoformat(),
        kpis={
            "total_receivables": float(ar_sum.total_receivables or 0),
            "total_payables": float(ap_sum.outstanding_payables or 0),
            "cash_and_bank_balance": cash_panel_total if cash_bank_accounts else float(gl_sum.cash_balance or 0),
            "gst_liability_period": gst_kpi["net_liability"],
            "gst_filing_due_label": gst_kpi["filing_due_label"],
            "todays_collections": money_in,
            "todays_payments": payments_today_out,
            "overdue_receivables": float(ar_sum.overdue or 0),
            "overdue_payables": overdue_ap_amount,
        },
        cash_flow_today={
            "money_in": money_in,
            "money_out": money_out,
            "net": net_cash_flow_today,
        },
        bank_accounts=cash_bank_accounts,
        receivables=receivables,
        payables=payables,
        invoice_summary=_invoice_summary(db, tenant_id, today),
        pending_work=pending_work,
        recent_activity=_recent_activity(db, tenant_id, today),
        expense_summary={
            "month_total": expense_mtd,
            "month_count": expense_count_mtd,
        },
        features={
            "expenses": True,
            "bank_reconciliation": True,
            "gst": True,
        },
        gst_period=gst_kpi,
    )
    return payload.model_dump()
