"""Normalize OpenAI-related settings for SDK and httpx clients."""

from __future__ import annotations

from urllib.parse import urlparse


def normalize_openai_api_key(key: str | None) -> str:
    return (key or "").strip()


def normalize_openai_base_url(url: str | None) -> str | None:
    """
    Return a Chat Completions-compatible base URL, or None for the SDK default.

    Empty strings and bare ``https://api.openai.com`` (no ``/v1``) cause 404s on
    ``/chat/completions`` for both httpx and the OpenAI Python SDK.
    """
    raw = (url or "").strip()
    if not raw:
        return None
    raw = raw.rstrip("/")
    parsed = urlparse(raw)
    host = (parsed.netloc or "").lower()
    path = (parsed.path or "").rstrip("/")
    if host == "api.openai.com" and path in ("", "/"):
        return "https://api.openai.com/v1"
    return raw
