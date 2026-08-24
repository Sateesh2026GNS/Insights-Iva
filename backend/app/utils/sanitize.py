"""Input sanitization helpers for user-provided strings."""

import re

_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
_PATH_TRAVERSAL = re.compile(r"(?:\.\.[\\/]|~[/\\])")
_SCRIPT_TAGS = re.compile(r"<\s*script\b[^>]*>.*?</\s*script\s*>", re.I | re.S)


def sanitize_text(value: str | None, *, max_length: int = 2000) -> str | None:
    if value is None:
        return None
    cleaned = _CONTROL_CHARS.sub("", value.strip())
    cleaned = _SCRIPT_TAGS.sub("", cleaned)
    return cleaned[:max_length]


def sanitize_filename(value: str | None) -> str | None:
    if not value:
        return None
    name = value.strip().replace("\\", "/").split("/")[-1]
    name = re.sub(r"[^a-zA-Z0-9._-]", "_", name)
    if _PATH_TRAVERSAL.search(name):
        return None
    return name[:255] or None


def sanitize_email_local_part(value: str) -> str:
    return sanitize_text(value, max_length=255) or ""


def sanitize_password(value: str | None) -> str:
    """Strip control characters from passwords; preserve printable characters."""
    if value is None:
        return ""
    return _CONTROL_CHARS.sub("", value)[:128]
