"""Indian mobile number validation (10-digit, starts with 6–9)."""

import re

_NON_DIGIT = re.compile(r"[^\d]")


def _normalize_digits(value: str) -> str:
    raw = str(value).strip().replace(" ", "").replace("-", "")
    if raw.startswith("+91"):
        raw = raw[3:]
    elif raw.startswith("91") and len(raw) > 10:
        raw = raw[2:]
    if _NON_DIGIT.search(raw):
        raise ValueError("Use digits only.")
    return raw


def validate_indian_mobile_required(value: str) -> str:
    digits = _normalize_digits(value)
    if len(digits) != 10:
        raise ValueError("Mobile number must be 10 digits.")
    if digits[0] not in "6789":
        raise ValueError("Mobile number must start with 6, 7, 8 or 9.")
    return digits


def validate_indian_mobile_optional(value: str | None) -> str | None:
    if value is None or not str(value).strip():
        return None
    return validate_indian_mobile_required(value)
