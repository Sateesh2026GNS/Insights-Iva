"""Quotation report summary fields for KPI cards."""

from datetime import date

from app.core.database import SessionLocal
from app.models.sales import Quotation
from app.services.sales_extended_service import get_quotation_summary


def test_quotation_summary_pipeline_and_converted_counts(register_admin):
    admin = register_admin()
    tenant_id = admin["user"]["tenant_id"]

    db = SessionLocal()
    try:
        db.add(
            Quotation(
                tenant_id=tenant_id,
                quote_number="Q-100",
                customer_name="Acme",
                status="sent",
                total_amount=100_000,
                quote_date=date.today(),
            )
        )
        db.add(
            Quotation(
                tenant_id=tenant_id,
                quote_number="Q-200",
                customer_name="Beta",
                status="accepted",
                total_amount=50_000,
                quote_date=date.today(),
            )
        )
        db.commit()

        summary = get_quotation_summary(db, tenant_id)
        assert summary.total_quotations == 2
        assert summary.open_quotations == 1
        assert summary.pipeline_value == 150_000.0
        assert summary.accepted == 1
    finally:
        db.close()
