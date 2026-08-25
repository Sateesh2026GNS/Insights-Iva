"""Shared journal posting for invoice/payment and manual JVs."""

from __future__ import annotations

from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.accounts import JournalEntry, JournalLeg


def post_journal_entry(
    db: Session,
    tenant_id: int,
    *,
    entry_date: date,
    reference: str | None,
    description: str | None,
    legs: list[dict],
    status: str = "Posted",
    branch: str = "Head Office",
    commit: bool = False,
) -> JournalEntry:
    """
    Create a balanced journal entry.
    Each leg: {"account": str, "debit": float, "credit": float}
    """
    total_debit = sum(float(l.get("debit") or 0) for l in legs)
    total_credit = sum(float(l.get("credit") or 0) for l in legs)
    if round(total_debit, 2) != round(total_credit, 2):
        raise ValueError(
            f"Unbalanced journal: debit={total_debit} credit={total_credit}"
        )
    if total_debit <= 0:
        raise ValueError("Journal must have positive amounts")
    for leg in legs:
        acct = str(leg.get("account") or "").strip()
        if not acct:
            raise ValueError("Journal leg account name is required and cannot be empty")

    stmt = (
        select(JournalEntry)
        .where(
            JournalEntry.tenant_id == tenant_id,
            func.extract("year", JournalEntry.entry_date) == entry_date.year,
        )
        .order_by(JournalEntry.id.desc())
        .with_for_update()
    )
    latest = db.scalars(stmt).first()
    if latest and latest.entry_number and latest.entry_number.startswith(f"JV-{entry_date.year}-"):
        try:
            seq_part = latest.entry_number.rsplit("-", 1)[-1]
            next_seq = int(seq_part) + 1
        except Exception:
            count = (
                db.scalar(
                    select(func.count(JournalEntry.id)).where(
                        JournalEntry.tenant_id == tenant_id,
                        func.extract("year", JournalEntry.entry_date) == entry_date.year,
                    )
                )
                or 0
            )
            next_seq = count + 1
    else:
        count = (
            db.scalar(
                select(func.count(JournalEntry.id)).where(
                    JournalEntry.tenant_id == tenant_id,
                    func.extract("year", JournalEntry.entry_date) == entry_date.year,
                )
            )
            or 0
        )
        next_seq = count + 1

    while True:
        entry_number = f"JV-{entry_date.year}-{next_seq:04d}"
        exists = db.scalar(
            select(JournalEntry.id).where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.entry_number == entry_number,
            )
        )
        if not exists:
            break
        next_seq += 1

    entry = JournalEntry(
        tenant_id=tenant_id,
        entry_number=entry_number,
        entry_date=entry_date,
        reference=reference,
        description=description,
        status=status,
        branch=branch,
    )
    try:
        db.add(entry)
        db.flush()
        for leg in legs:
            acc_name = str(leg.get("account") or "").strip()
            if not acc_name:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Journal leg account name cannot be empty or whitespace-only",
                )
            db.add(
                JournalLeg(
                    entry_id=entry.id,
                    account=acc_name,
                    debit=float(leg.get("debit") or 0),
                    credit=float(leg.get("credit") or 0),
                )
            )
        if commit:
            db.commit()
            db.refresh(entry)
        else:
            db.flush()
        return entry
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise


def get_journal_entry(
    db: Session, tenant_id: int, entry_id: int
) -> JournalEntry | None:
    from sqlalchemy.orm import joinedload

    return db.scalar(
        select(JournalEntry)
        .where(JournalEntry.id == entry_id, JournalEntry.tenant_id == tenant_id)
        .options(joinedload(JournalEntry.legs))
    )


def update_journal_entry(
    db: Session,
    tenant_id: int,
    entry_id: int,
    *,
    entry_date: date | None = None,
    reference: str | None = None,
    description: str | None = None,
    status: str | None = None,
    branch: str | None = None,
    legs: list[dict] | None = None,
) -> JournalEntry | None:
    entry = db.scalar(
        select(JournalEntry).where(
            JournalEntry.id == entry_id, JournalEntry.tenant_id == tenant_id
        )
    )
    if not entry:
        return None
    if entry_date is not None:
        entry.entry_date = entry_date
    if reference is not None:
        entry.reference = reference
    if description is not None:
        entry.description = description
    if status is not None:
        entry.status = status
    if branch is not None:
        entry.branch = branch
    try:
        if legs is not None:
            total_debit = sum(float(l.get("debit") or 0) for l in legs)
            total_credit = sum(float(l.get("credit") or 0) for l in legs)
            if round(total_debit, 2) != round(total_credit, 2):
                raise ValueError(
                    f"Unbalanced journal: debit={total_debit} credit={total_credit}"
                )
            if total_debit <= 0:
                raise ValueError("Journal must have positive amounts")
            for leg in legs:
                acct = str(leg.get("account") or "").strip()
                if not acct:
                    raise ValueError("Journal leg account name is required and cannot be empty")
            for existing in list(entry.legs or []):
                db.delete(existing)
            db.flush()
            for leg in legs:
                db.add(
                    JournalLeg(
                        entry_id=entry.id,
                        account=str(leg.get("account")).strip(),
                        debit=float(leg.get("debit") or 0),
                        credit=float(leg.get("credit") or 0),
                    )
                )
        db.commit()
        db.refresh(entry)
        return entry
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise


def delete_journal_entry(db: Session, tenant_id: int, entry_id: int) -> bool:
    entry = db.scalar(
        select(JournalEntry).where(
            JournalEntry.id == entry_id, JournalEntry.tenant_id == tenant_id
        )
    )
    if not entry:
        return False
    try:
        db.delete(entry)
        db.commit()
        return True
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass
        raise


def post_sales_invoice_journal(
    db: Session,
    tenant_id: int,
    *,
    invoice_number: str,
    issue_date: date,
    subtotal: float,
    discount: float,
    sgst: float,
    cgst: float,
    igst: float,
    round_off: float,
    grand_total: float,
) -> JournalEntry | None:
    """Dr AR / Cr Sales + GST outputs for a tax invoice."""
    net_sales = round(float(subtotal or 0) - float(discount or 0), 2)
    legs: list[dict] = [
        {"account": "Accounts Receivable", "debit": float(grand_total), "credit": 0},
        {"account": "Sales Revenue", "debit": 0, "credit": net_sales},
    ]
    if float(sgst or 0) > 0:
        legs.append({"account": "Output SGST", "debit": 0, "credit": float(sgst)})
    if float(cgst or 0) > 0:
        legs.append({"account": "Output CGST", "debit": 0, "credit": float(cgst)})
    if float(igst or 0) > 0:
        legs.append({"account": "Output IGST", "debit": 0, "credit": float(igst)})
    if float(round_off or 0) != 0:
        if float(round_off) > 0:
            legs.append({"account": "Round Off", "debit": 0, "credit": float(round_off)})
        else:
            legs.append(
                {"account": "Round Off", "debit": abs(float(round_off)), "credit": 0}
            )

    debit = sum(float(l["debit"]) for l in legs)
    credit = sum(float(l["credit"]) for l in legs)
    diff = round(debit - credit, 2)
    if abs(diff) >= 0.01:
        # Auto-adjust small floating point discrepancy into Round Off leg
        round_leg = next((l for l in legs if l["account"] == "Round Off"), None)
        if round_leg:
            if diff > 0:
                round_leg["credit"] += diff
            else:
                round_leg["debit"] += abs(diff)
        else:
            if diff > 0:
                legs.append({"account": "Round Off", "debit": 0, "credit": diff})
            else:
                legs.append({"account": "Round Off", "debit": abs(diff), "credit": 0})

    try:
        return post_journal_entry(
            db,
            tenant_id,
            entry_date=issue_date,
            reference=invoice_number,
            description=f"Sales invoice {invoice_number}",
            legs=legs,
            commit=False,
        )
    except ValueError as exc:
        raise ValueError(str(exc)) from exc


def post_sales_payment_journal(
    db: Session,
    tenant_id: int,
    *,
    invoice_number: str,
    payment_date: date,
    amount: float,
    method: str = "cash",
) -> JournalEntry | None:
    """Dr Cash/Bank / Cr AR for customer payment."""
    val = float(amount or 0)
    if val <= 0:
        raise ValueError("Payment amount must be greater than zero")

    cash_account = "Bank" if (method or "").lower() in ("bank", "upi", "neft", "rtgs", "card") else "Cash"
    legs = [
        {"account": cash_account, "debit": val, "credit": 0},
        {"account": "Accounts Receivable", "debit": 0, "credit": val},
    ]
    try:
        return post_journal_entry(
            db,
            tenant_id,
            entry_date=payment_date,
            reference=invoice_number,
            description=f"Payment against invoice {invoice_number}",
            legs=legs,
            commit=False,
        )
    except ValueError as exc:
        raise ValueError(str(exc)) from exc


def reverse_sales_invoice_journal(
    db: Session,
    tenant_id: int,
    *,
    invoice_number: str,
    issue_date: date | None = None,
    subtotal: float = 0,
    discount: float = 0,
    sgst: float = 0,
    cgst: float = 0,
    igst: float = 0,
    round_off: float = 0,
    grand_total: float = 0,
) -> JournalEntry | None:
    """Cancel or reverse accounting journal entries for a cancelled invoice."""
    entries = list(
        db.scalars(
            select(JournalEntry).where(
                JournalEntry.tenant_id == tenant_id,
                JournalEntry.reference == invoice_number,
            )
        ).all()
    )
    for entry in entries:
        entry.status = "Cancelled"

    if float(grand_total or 0) > 0:
        net_sales = round(float(subtotal or 0) - float(discount or 0), 2)
        legs: list[dict] = [
            {"account": "Accounts Receivable", "debit": 0, "credit": float(grand_total)},
            {"account": "Sales Revenue", "debit": net_sales, "credit": 0},
        ]
        if float(sgst or 0) > 0:
            legs.append({"account": "Output SGST", "debit": float(sgst), "credit": 0})
        if float(cgst or 0) > 0:
            legs.append({"account": "Output CGST", "debit": float(cgst), "credit": 0})
        if float(igst or 0) > 0:
            legs.append({"account": "Output IGST", "debit": float(igst), "credit": 0})
        if float(round_off or 0) != 0:
            if float(round_off) > 0:
                legs.append({"account": "Round Off", "debit": float(round_off), "credit": 0})
            else:
                legs.append(
                    {"account": "Round Off", "debit": 0, "credit": abs(float(round_off))}
                )

        debit = sum(float(l["debit"]) for l in legs)
        credit = sum(float(l["credit"]) for l in legs)
        diff = round(debit - credit, 2)
        if abs(diff) >= 0.01:
            legs[0]["credit"] = round(float(legs[0]["credit"]) - diff, 2)

        try:
            return post_journal_entry(
                db,
                tenant_id,
                entry_date=issue_date or date.today(),
                reference=f"REV-{invoice_number}",
                description=f"Reversal for cancelled invoice {invoice_number}",
                legs=legs,
                commit=False,
            )
        except ValueError:
            return None
    return None
