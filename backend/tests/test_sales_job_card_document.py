"""Regression tests for Sales Job Card document payload assembly."""

from datetime import date
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services.sales_job_card_document import build_sales_job_card_document


def test_build_document_falls_back_to_resolved_details_without_nameerror():
    so = SimpleNamespace(
        customer=None,
        order_number="SO-REG-001",
        reference_number="PO-9",
        order_date=date(2026, 3, 1),
        delivery_date=date(2026, 4, 1),
        end_use=None,
        payment_terms=None,
        payment_terms_description=None,
        priority=None,
        sales_person="Ada",
        notes=None,
    )
    payload = build_sales_job_card_document(
        MagicMock(),
        so=so,
        lines=[],
        resolved_details={
            "manual_document": {
                "order": {
                    "end_use": "Packaging",
                    "payment_terms": "Net 30",
                    "payment_terms_description": "Due in 30 days",
                    "priority": "high",
                    "remarks": "Rush",
                }
            },
            "order_details": {"end_use": "ignored-when-manual-present"},
        },
    )
    order = payload["order_details"]
    assert order["end_use"] == "Packaging"
    assert order["payment_terms"] == "Net 30"
    assert order["payment_terms_description"] == "Due in 30 days"
    assert order["priority"] == "high"
    assert order["remarks"] == "Rush"
    assert order["sales_person"] == "Ada"
    assert payload["header"]["sales_order_no"] == "SO-REG-001"
