"""Indian phone number validation utilities."""

from __future__ import annotations

import re


def validate_indian_mobile_required(value: str) -> str:
    """Validate and normalize a 10-digit Indian mobile number."""
    if value is None:
        raise ValueError("Mobile number must be 10 digits.")
    val = str(value).strip()
    if not val:
        raise ValueError("Mobile number must be 10 digits.")

    compact = re.sub(r"[\s\-\(\)]", "", val)
    if compact.startswith("+91"):
        digit_part = compact[3:]
    elif compact.startswith("91") and len(compact) > 10:
        digit_part = compact[2:]
    elif compact.startswith("0") and len(compact) == 11:
        digit_part = compact[1:]
    else:
        digit_part = compact

    if not digit_part.isdigit():
        raise ValueError("Use digits only.")
    if len(digit_part) != 10:
        raise ValueError("Mobile number must be 10 digits.")
    if digit_part[0] not in "6789":
        raise ValueError("Mobile number must start with 6, 7, 8 or 9.")

    return digit_part


def validate_indian_mobile_optional(value: str | None) -> str | None:
    """Validate optional Indian mobile number."""
    if value is None or not str(value).strip():
        return None
    return validate_indian_mobile_required(str(value))
