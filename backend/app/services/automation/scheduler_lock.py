"""PostgreSQL advisory lock so only one app instance runs a scheduler tick.

Uses session-level ``pg_try_advisory_lock`` (not xact-level) so intermediate
``db.rollback()`` during a tick does not release the lock. The same SQLAlchemy
``Session`` / connection must acquire and release; ``scheduler._run_all_tenants``
releases in ``finally`` and closes the session (disconnect also drops the lock).
"""

from __future__ import annotations

import logging

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.config import get_settings

logger = logging.getLogger("gns_insights.automation.scheduler")

# Stable cluster-wide key (single global scheduler tick).
_SCHEDULER_ADVISORY_LOCK_KEY = 918_273_645


def try_acquire_scheduler_lock(db: Session) -> bool:
    """Return True when this process may run the scheduler tick."""
    settings = get_settings()
    if settings.is_sqlite:
        return True
    try:
        # Bind to this session's connection for the lifetime of the tick.
        acquired = db.execute(
            text("SELECT pg_try_advisory_lock(:key)"),
            {"key": _SCHEDULER_ADVISORY_LOCK_KEY},
        ).scalar()
        return bool(acquired)
    except Exception:
        logger.exception("scheduler_advisory_lock_acquire_failed")
        return False


def release_scheduler_lock(db: Session) -> None:
    """Release the session-level advisory lock on the same connection that acquired it."""
    settings = get_settings()
    if settings.is_sqlite:
        return
    try:
        db.execute(
            text("SELECT pg_advisory_unlock(:key)"),
            {"key": _SCHEDULER_ADVISORY_LOCK_KEY},
        )
    except Exception:
        logger.exception("scheduler_advisory_lock_release_failed")
