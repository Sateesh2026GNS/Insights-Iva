"""Indian GSTIN validation helpers."""

from __future__ import annotations

import re

# 2 digit state + 10 char PAN + entity + Z + checksum
_GSTIN_RE = re.compile(
    r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$"
)

_GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def normalize_gstin(value: str | None) -> str | None:
    if value is None:
        return None
    cleaned = re.sub(r"\s+", "", str(value).strip().upper())
    return cleaned or None


def validate_gstin(value: str | None, *, required: bool = False) -> str | None:
    """
    Validate Indian GSTIN format + checksum.
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
        raise ValueError("Invalid GST Number format")
    # Checksum (mod 36)
    total = 0
    for i, ch in enumerate(gstin[:14]):
        code = _GSTIN_CHARS.index(ch)
        product = code * (1 if i % 2 == 0 else 2)
        total += (product // 36) + (product % 36)
    check = (36 - (total % 36)) % 36
    if _GSTIN_CHARS[check] != gstin[14]:
        raise ValueError("Invalid GST Number checksum")
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
