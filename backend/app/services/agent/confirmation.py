from __future__ import annotations

import secrets
import time
from dataclasses import dataclass
from typing import Any

CONFIRMATION_TTL_SECONDS = 300


@dataclass
class PendingConfirmation:
    token: str
    tenant_id: int
    user_id: int
    tool_name: str
    payload: dict[str, Any]
    summary: str
    created_at: float


_store: dict[str, PendingConfirmation] = {}


def create_confirmation(
    *,
    tenant_id: int,
    user_id: int,
    tool_name: str,
    payload: dict[str, Any],
    summary: str,
) -> str:
    token = secrets.token_urlsafe(32)
    _store[token] = PendingConfirmation(
        token=token,
        tenant_id=tenant_id,
        user_id=user_id,
        tool_name=tool_name,
        payload=payload,
        summary=summary,
        created_at=time.time(),
    )
    return token


def pop_confirmation(token: str, tenant_id: int, user_id: int) -> PendingConfirmation | None:
    entry = _store.pop(token, None)
    if not entry:
        return None
    if entry.tenant_id != tenant_id or entry.user_id != user_id:
        return None
    if time.time() - entry.created_at > CONFIRMATION_TTL_SECONDS:
        return None
    return entry


def peek_confirmation(token: str) -> PendingConfirmation | None:
    entry = _store.get(token)
    if not entry:
        return None
    if time.time() - entry.created_at > CONFIRMATION_TTL_SECONDS:
        _store.pop(token, None)
        return None
    return entry
