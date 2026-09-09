"""Backend validation for party modal sections."""

import pytest
from pydantic import ValidationError

from app.schemas.party_form import PartyBasicDetails, PartyCustomField, PartyOtherDetails
from app.schemas.sales import CustomerCreate


def test_basic_details_rejects_empty_credit_period():
    with pytest.raises(ValidationError) as exc:
        PartyBasicDetails(
            payment_terms_days="",
            opening_balance=100,
            balance_type="to_receive",
        )
    assert "Credit Period" in str(exc.value)


def test_basic_details_rejects_negative_opening_balance():
    with pytest.raises(ValidationError):
        PartyBasicDetails(
            payment_terms_days=30,
            opening_balance=-1,
            balance_type="to_receive",
        )


def test_basic_details_rejects_invalid_email():
    with pytest.raises(ValidationError):
        PartyBasicDetails(
            payment_terms_days=30,
            opening_balance=0,
            balance_type="to_receive",
            email="not-an-email",
        )


def test_other_details_rejects_missing_gst_treatment():
    with pytest.raises(ValidationError) as exc:
        PartyOtherDetails(
            party_type="Buyer",
            gst_treatment="",
            tax_preference="Taxable",
        )
    assert "GST Treatment" in str(exc.value)


def test_custom_field_rejects_whitespace_only():
    with pytest.raises(ValidationError):
        PartyCustomField(label="   ", value="value")


def test_customer_create_rejects_invalid_party_basic_details():
    with pytest.raises(ValidationError):
        CustomerCreate(
            tenant_id=1,
            name="Acme Corp",
            party_basic_details={
                "payment_terms_days": "",
                "opening_balance": 100,
                "balance_type": "to_receive",
            },
        )


def test_customer_create_accepts_valid_party_sections():
    payload = CustomerCreate(
        tenant_id=1,
        name="Acme Corp",
        party_basic_details={
            "payment_terms_days": 30,
            "opening_balance": 500,
            "balance_type": "to_pay",
            "email": "billing@acme.example",
        },
        party_other_details={
            "party_type": "Buyer",
            "gst_treatment": "Registered Business - Regular",
            "tax_preference": "Taxable",
        },
        party_custom_fields=[{"label": "PAN", "value": "ABCDE1234F"}],
    )
    assert payload.party_basic_details.opening_balance == 500
