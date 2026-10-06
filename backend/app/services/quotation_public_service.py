"""Secure public e-Quotation viewing by opaque token."""

from __future__ import annotations

from datetime import date
from typing import Any
from urllib.parse import urlparse

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.sales import Quotation
from app.services.document_builder_service import build_quotation_document
from app.utils.security_tokens import generate_token

# Statuses that must not be viewable via public QR link.
_PUBLIC_BLOCKED_STATUSES = frozenset({"draft", "cancelled", "rejected", "expired"})


def _is_loopback_host(hostname: str | None) -> bool:
    host = (hostname or "").lower().strip()
    if not host:
        return True
    if host in {"localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"}:
        return True
    return host.endswith(".local")


def _is_loopback_origin(origin: str) -> bool:
    try:
        parsed = urlparse(origin)
    except Exception:
        return True
    return _is_loopback_host(parsed.hostname)


def resolve_frontend_public_base_url(*, allow_loopback: bool = False) -> str:
    """Base URL for e-Quotation QR links. Skips loopback unless allow_loopback or explicitly configured."""
    settings = get_settings()
    explicit = (settings.frontend_public_base_url or "").strip().rstrip("/")
    if explicit:
        if allow_loopback or not _is_loopback_origin(explicit):
            return explicit

    for origin in settings.cors_origin_list:
        o = (origin or "").strip().rstrip("/")
        if o and not _is_loopback_origin(o):
            return o

    if explicit and allow_loopback:
        return explicit

    for origin in settings.cors_origin_list:
        o = (origin or "").strip().rstrip("/")
        if o and allow_loopback:
            return o

    return ""


def public_e_quotation_url(token: str) -> str:
    base = resolve_frontend_public_base_url(allow_loopback=False)
    safe = (token or "").strip()
    path = f"/e-quotation/{safe}"
    if not base:
        return path
    return f"{base}{path}"


def ensure_quotation_public_view_token(db: Session, quote: Quotation) -> str:
    existing = (getattr(quote, "public_view_token", None) or "").strip()
    if existing:
        return existing
    for _ in range(8):
        candidate = generate_token()
        clash = db.scalars(
            select(Quotation.id).where(Quotation.public_view_token == candidate)
        ).first()
        if clash:
            continue
        quote.public_view_token = candidate
        db.add(quote)
        db.commit()
        db.refresh(quote)
        return candidate
    raise HTTPException(status_code=500, detail="Unable to allocate public quotation link.")


def _public_availability(quote: Quotation) -> tuple[bool, str]:
    status = (quote.status or "draft").lower().strip()
    if status in _PUBLIC_BLOCKED_STATUSES:
        return False, "unavailable"
    if quote.valid_until and quote.valid_until < date.today():
        return False, "expired"
    return True, "ok"


def get_quotation_by_public_token(db: Session, token: str) -> Quotation | None:
    safe = (token or "").strip()
    if not safe or len(safe) < 16:
        return None
    return db.scalars(select(Quotation).where(Quotation.public_view_token == safe)).first()


def attach_public_qr_urls(doc: dict[str, Any], token: str) -> dict[str, Any]:
    url = public_e_quotation_url(token)
    doc["qr_url"] = url
    doc["qr_value"] = url
    return doc


def build_public_quotation_document(db: Session, token: str) -> dict[str, Any]:
    quote = get_quotation_by_public_token(db, token)
    if not quote:
        raise HTTPException(status_code=404, detail="Quotation not found or the link is invalid.")
    ok, reason = _public_availability(quote)
    if not ok:
        if reason == "expired":
            raise HTTPException(status_code=410, detail="This quotation is no longer available.")
        raise HTTPException(status_code=410, detail="This quotation is no longer available.")
    ensure_quotation_public_view_token(db, quote)
    doc = build_quotation_document(db, quote.tenant_id, quote.id)
    if not doc:
        raise HTTPException(status_code=404, detail="Quotation not found or the link is invalid.")
    token_value = (quote.public_view_token or "").strip()
    return attach_public_qr_urls(doc, token_value)


def enrich_quotation_document_for_qr(db: Session, tenant_id: int, quote_id: int, doc: dict[str, Any]) -> dict[str, Any]:
    quote = db.scalars(
        select(Quotation).where(Quotation.id == quote_id, Quotation.tenant_id == tenant_id)
    ).first()
    if not quote:
        return doc
    token = ensure_quotation_public_view_token(db, quote)
    return attach_public_qr_urls(doc, token)
