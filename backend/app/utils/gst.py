"""Indian GSTIN validation helpers."""

from __future__ import annotations

import re

# Exactly 15 alphanumeric characters with at least one letter and one number
_GSTIN_RE = re.compile(r"^(?=.*[0-9])(?=.*[A-Z])[A-Z0-9]{15}$")


def normalize_gstin(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", "", str(value).strip().upper())
    return cleaned or None


def validate_gstin(value: str | None, *, required: bool = False) -> str | None:
    """
    Validate Indian GSTIN: exactly 15 alphanumeric characters with at least one letter and one number.
    Returns normalized GSTIN or None if empty and not required.
    Raises ValueError on invalid format.
    """
    gstin = normalize_gstin(value)
    if not gstin:
        if required:
            raise ValueError("GST Number is required")
        return None
    if len(gstin) != 15:
        raise ValueError("GST Number must be exactly 15 characters")
    if not _GSTIN_RE.match(gstin):
        raise ValueError(
            "GST Number must be 15 alphanumeric characters with at least one letter and one number"
        )
    return gstin


def normalize_indian_mobile(value: str) -> str:
    from app.utils.indian_phone import validate_indian_mobile_required

    return validate_indian_mobile_required(value)


def normalize_indian_pin(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) != 6:
        raise ValueError("PIN Code must be a 6-digit Indian postal code")
    if digits[0] == "0":
        raise ValueError("PIN Code cannot start with 0")
    return digits


_PAN_RE = re.compile(r"^[A-Z]{5}[0-9]{4}[A-Z]$")
_IFSC_RE = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")


def validate_pan(value: str | None, *, required: bool = False) -> str | None:
    if value is None or not str(value).strip():
        if required:
            raise ValueError("PAN Number is required")
        return None
    pan = re.sub(r"\s+", "", str(value).strip().upper())
    if not _PAN_RE.match(pan):
        raise ValueError("Invalid PAN Number format (e.g. ABCDE1234F)")
    return pan


def validate_ifsc(value: str | None, *, required: bool = False) -> str | None:
    if value is None or not str(value).strip():
        if required:
            raise ValueError("IFSC Code is required")
        return None
    ifsc = re.sub(r"\s+", "", str(value).strip().upper())
    if not _IFSC_RE.match(ifsc):
        raise ValueError("Invalid IFSC Code format (e.g. SBIN0001234)")
    return ifsc


def normalize_optional_mobile(value: str | None) -> str | None:
    if value is None or not str(value).strip():
        return None
    return normalize_indian_mobile(value)
