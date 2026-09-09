"""Sanitize error messages before returning them to API clients."""

from __future__ import annotations

import re

# Patterns that indicate internal details must not reach clients.
_INTERNAL_MARKERS = re.compile(
    r"(?i)"
    r"(psycopg|sqlalchemy|traceback|uniqueviolation|foreignkeyviolation|"
    r"integrityerror|operationalerror|programmingerror|"
    r"duplicate\s+key|relation\s+\"|column\s+\"|"
    r"(?:api[_-]?key|secret|jwt|token|presigned)\s*[:=]|"
    r"bearer\s+ey[a-z0-9_-]{10,}|"
    r"[A-Za-z]:\\|/var/|/home/|/Users/|\\\\)"
)

_GENERIC_500 = "An unexpected error occurred. Please try again."
_GENERIC_409 = "Unable to complete this operation because the record already exists or conflicts with existing data."
_GENERIC_503 = "The service is temporarily unavailable. Please try again later."


def sanitize_client_message(message: str | None, *, status_code: int = 500) -> str:
    """Return a safe user-facing message; never expose stack traces or internals."""
    if message is None:
        message = ""
    text = str(message).strip()
    if not text:
        if status_code == 409:
            return _GENERIC_409
        if status_code == 503:
            return _GENERIC_503
        return _GENERIC_500

    if _INTERNAL_MARKERS.search(text):
        if status_code == 409:
            return _GENERIC_409
        if status_code == 503:
            return _GENERIC_503
        return _GENERIC_500

    # Cap excessively long messages (possible dump)
    if len(text) > 500:
        return _GENERIC_500

    return text
