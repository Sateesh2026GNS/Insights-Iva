"""Shared concurrency helpers — PostgreSQL remains the source of truth."""

from __future__ import annotations

from fastapi import HTTPException


CONFLICT_REFRESH_MESSAGE = (
    "This record was updated by another user. Please refresh and try again."
)


def raise_conflict(detail: str | None = None) -> None:
    """Raise HTTP 409 for stale state / concurrent modification."""
    raise HTTPException(status_code=409, detail=detail or CONFLICT_REFRESH_MESSAGE)


def raise_insufficient_stock(
    available: int | float,
    requested: int | float,
    *,
    unit: str | None = None,
) -> None:
    """Raise HTTP 409 when stock issue would exceed current on-hand quantity."""
    unit_suffix = f" {unit}" if unit else ""
    raise HTTPException(
        status_code=409,
        detail=(
            f"Insufficient stock. Current available quantity is {available}{unit_suffix}."
        ),
    )


def bump_record_version(details: dict) -> int:
    """Increment optimistic version stored in JSON details (no schema migration)."""
    current = int(details.get("record_version") or 0)
    details["record_version"] = current + 1
    return current + 1


def assert_expected_record_version(
    details: dict,
    expected_version: int | None,
) -> None:
    """Reject stale client payloads when an expected version is supplied."""
    if expected_version is None:
        return
    current = int(details.get("record_version") or 0)
    if int(expected_version) != current:
        raise_conflict()


def assert_entity_version(entity, expected_version: int | None) -> None:
    """Reject stale updates when client supplies expected ORM version."""
    if expected_version is None:
        return
    current = int(getattr(entity, "version", 1) or 1)
    if int(expected_version) != current:
        raise_conflict(
            "This record was updated by another user. Please refresh and review "
            "the latest data before saving."
        )


def bump_entity_version(entity) -> int:
    """Increment optimistic-lock version on a mapped entity."""
    current = int(getattr(entity, "version", 1) or 1)
    if hasattr(entity, "version"):
        entity.version = current + 1
    return current + 1
