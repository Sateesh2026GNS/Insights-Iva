"""Password strength validation for registration and reset flows."""

import re

PASSWORD_MIN_LENGTH = 8

_MSG_MIN_LENGTH = "Password must be at least 8 characters."
_MSG_UPPER = "Password must include at least one uppercase letter."
_MSG_LOWER = "Password must include at least one lowercase letter."
_MSG_DIGIT = "Password must include at least one number."
_MSG_SPECIAL = "Password must include at least one special character."
_MSG_COMMON = "Password is too common. Choose a stronger password."

# Small denylist of common passwords (extend via env/DB later)
_COMMON_PASSWORDS = frozenset(
    {
        "password",
        "password123",
        "password123!",
        "12345678",
        "123456789012",
        "qwerty123456",
        "admin123456!",
        "welcome12345",
        "changeme123!",
        "letmein12345",
        "gnsinsights1!",
    }
)


def validate_password_strength(password: str) -> None:
    """Raise ValueError when password does not meet enterprise policy."""
    if len(password) < PASSWORD_MIN_LENGTH:
        raise ValueError(_MSG_MIN_LENGTH)
    if not re.search(r"[A-Z]", password):
        raise ValueError(_MSG_UPPER)
    if not re.search(r"[a-z]", password):
        raise ValueError(_MSG_LOWER)
    if not re.search(r"\d", password):
        raise ValueError(_MSG_DIGIT)
    if not re.search(r"[^A-Za-z0-9]", password):
        raise ValueError(_MSG_SPECIAL)
    if password.lower() in _COMMON_PASSWORDS:
        raise ValueError(_MSG_COMMON)


def password_strength_errors(password: str) -> list[str]:
    """Return a list of unmet password rules (for UI hints)."""
    errors: list[str] = []
    if len(password) < PASSWORD_MIN_LENGTH:
        errors.append(_MSG_MIN_LENGTH)
    if not re.search(r"[A-Z]", password):
        errors.append(_MSG_UPPER)
    if not re.search(r"[a-z]", password):
        errors.append(_MSG_LOWER)
    if not re.search(r"\d", password):
        errors.append(_MSG_DIGIT)
    if not re.search(r"[^A-Za-z0-9]", password):
        errors.append(_MSG_SPECIAL)
    if password.lower() in _COMMON_PASSWORDS:
        errors.append(_MSG_COMMON)
    return errors
