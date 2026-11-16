"""Dev-only sample books for the Accounts Dashboard.

Refuses to run in production, and refuses to run unless
ACCOUNTS_DASHBOARD_DEV_SEED=1.

From backend/:

    $env:ACCOUNTS_DASHBOARD_DEV_SEED="1"
    python scripts/seed_accounts_dashboard_dev.py

Optional: ACCOUNTS_DASHBOARD_DEV_SEED_EMAIL (default admin@gnssoftwares.com).
Re-running does nothing when the marker invoice DEVSEED-PAID already exists.
"""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import func, select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.accounts import JournalEntry, JournalLeg
from app.models.hr_module import ExpenseClaim
from app.models.inventory import Supplier
from app.models.procurement import SupplierPayment
from app.models.sales import Customer, Invoice, Payment
from app.models.user import User


MARKER = "DEVSEED-PAID"


def _refuse() -> None:
    if os.environ.get("ACCOUNTS_DASHBOARD_DEV_SEED") != "1":
        raise SystemExit("Set ACCOUNTS_DASHBOARD_DEV_SEED=1 to run this dev-only seed.")
    settings = get_settings()
    if settings.is_production or os.environ.get("ENVIRONMENT", "").lower() == "production":
        raise SystemExit("Refusing to seed dashboard sample books in production.")


def _invoice(db, tenant_id, customer_id, number, *, status, payment_status, amount, paid, due, today):
    db.add(
        Invoice(
            tenant_id=tenant_id,
            customer_id=customer_id,
            invoice_number=number,
            issue_date=today,
            due_date=due,
            document_type="tax_invoice",
            invoice_status="active",
            payment_status=payment_status,
            subtotal=amount,
            grand_total=amount,
            amount_paid=paid,
            status=status,
        )
    )


def main() -> None:
    _refuse()
    email = os.environ.get("ACCOUNTS_DASHBOARD_DEV_SEED_EMAIL", "admin@gnssoftwares.com").strip().lower()
    today = date.today()
    db = SessionLocal()
    try:
        user = db.scalar(select(User).where(func.lower(User.email) == email))
        if user is None:
            raise SystemExit(f"No user found for {email}.")
        tenant_id = user.tenant_id
        existing = db.scalar(
            select(Invoice.id).where(Invoice.tenant_id == tenant_id, Invoice.invoice_number == MARKER)
        )
        if existing:
            print(f"Sample books already exist for tenant {tenant_id} ({MARKER}).")
            return

        customer = Customer(tenant_id=tenant_id, name="Dev Seed Customer", status="active")
        supplier = Supplier(tenant_id=tenant_id, name="Dev Seed Supplier", status="active")
        db.add(customer)
        db.add(supplier)
        db.flush()

        _invoice(
            db, tenant_id, customer.id, MARKER,
            status="paid", payment_status="paid", amount=12000, paid=12000, due=today, today=today,
        )
        _invoice(
            db, tenant_id, customer.id, "DEVSEED-SENT",
            status="sent", payment_status="unpaid", amount=20000, paid=0, due=today + timedelta(days=30), today=today,
        )
        _invoice(
            db, tenant_id, customer.id, "DEVSEED-DUE-SOON",
            status="sent", payment_status="unpaid", amount=15000, paid=0, due=today + timedelta(days=3), today=today,
        )
        _invoice(
            db, tenant_id, customer.id, "DEVSEED-OVERDUE-15",
            status="sent", payment_status="unpaid", amount=8000, paid=0, due=today - timedelta(days=15), today=today,
        )
        _invoice(
            db, tenant_id, customer.id, "DEVSEED-OVERDUE-45",
            status="sent", payment_status="unpaid", amount=6000, paid=0, due=today - timedelta(days=45), today=today,
        )
        _invoice(
            db, tenant_id, customer.id, "DEVSEED-OVERDUE-100",
            status="sent", payment_status="unpaid", amount=4000, paid=0, due=today - timedelta(days=100), today=today,
        )
        db.flush()
        paid = db.scalar(
            select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.invoice_number == MARKER)
        )

        for index, amount in enumerate((4000, 3000, 2500), start=1):
            db.add(
                Payment(
                    tenant_id=tenant_id,
                    invoice_id=paid.id,
                    amount=amount,
                    payment_date=today,
                    method="bank",
                    notes="Dev seed receipt",
                    idempotency_key=f"DEVSEED-RCPT-{index}",
                    payment_reference=f"DEVSEED-RCPT-{index}",
                )
            )
        for index, amount in enumerate((1800, 900), start=1):
            db.add(
                SupplierPayment(
                    tenant_id=tenant_id,
                    supplier_id=supplier.id,
                    payment_date=today,
                    amount=amount,
                    payment_method="bank",
                    reference=f"DEVSEED-SP-{index}",
                    notes="Dev seed supplier payment",
                    idempotency_key=f"DEVSEED-SP-{index}",
                )
            )
        journal = JournalEntry(
            tenant_id=tenant_id,
            entry_number="DEVSEED-JE-1",
            entry_date=today,
            reference="DEVSEED",
            description="Dev seed journal",
            status="Posted",
        )
        journal.legs = [
            JournalLeg(account="Sales", debit=0, credit=1000),
            JournalLeg(account="Accounts receivable", debit=1000, credit=0),
        ]
        db.add(journal)
        db.add(
            ExpenseClaim(
                tenant_id=tenant_id,
                expense_name="Site travel",
                expense_category="travel",
                amount=2200,
                expense_date=today,
                status="pending",
                created_by_name="Dev Claimant",
            )
        )
        db.add(
            ExpenseClaim(
                tenant_id=tenant_id,
                expense_name="Conveyance",
                expense_category="travel",
                amount=900,
                expense_date=today,
                status="pending",
                created_by_name="Plant Supervisor",
            )
        )
        db.commit()
        print(f"Seeded sample books for tenant {tenant_id}.")
    finally:
        db.close()


if __name__ == "__main__":
    main()
