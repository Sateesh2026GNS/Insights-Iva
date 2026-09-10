"""Idempotency helpers for critical POST operations."""

from __future__ import annotations

from typing import TypeVar

from fastapi import Header, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

T = TypeVar("T")


def normalize_idempotency_key(value: str | None) -> str | None:
    if value is None:
        return None
    key = str(value).strip()
    if not key:
        return None
    if len(key) > 128:
        raise HTTPException(status_code=422, detail="Idempotency-Key must be at most 128 characters.")
    return key


def get_idempotency_key_header(
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
) -> str | None:
    return normalize_idempotency_key(idempotency_key)


def find_idempotent_record(
    db: Session,
    model: type[T],
    tenant_id: int,
    idempotency_key: str | None,
) -> T | None:
    if not idempotency_key:
        return None
    if not hasattr(model, "idempotency_key"):
        return None
    return db.scalars(
        select(model).where(
            model.tenant_id == tenant_id,
            model.idempotency_key == idempotency_key,
        )
    ).first()
