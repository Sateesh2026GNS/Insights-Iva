"""PostgreSQL-backed rate limits for multi-instance deployments (high-risk scopes only)."""

from __future__ import annotations

import logging
import time
from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.security import RateLimitBucket

logger = logging.getLogger(__name__)

# Scopes enforced in DB when RATE_LIMIT_DISTRIBUTED=true (not per-navigation GET traffic).
DISTRIBUTED_RATE_LIMIT_SCOPES = frozenset({
    "login",
    "register",
    "otp",
    "forgot_password",
    "api_agent",
    "upload",
    "api_reports",
})


def distributed_rate_limit_enabled() -> bool:
    return bool(get_settings().rate_limit_distributed)


def should_use_distributed(scope: str) -> bool:
    if not distributed_rate_limit_enabled():
        return False
    settings = get_settings()
    if settings.is_sqlite:
        return False
    return scope in DISTRIBUTED_RATE_LIMIT_SCOPES


def clear_distributed_rate_limits() -> None:
    """Test helper — wipe distributed buckets."""
    db = SessionLocal()
    try:
        db.execute(delete(RateLimitBucket))
        db.commit()
    except Exception:
        db.rollback()
    finally:
        db.close()


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _prune_old_windows(db: Session, window_seconds: int, now_epoch: float) -> None:
    cutoff = int(now_epoch) - (window_seconds * 2)
    db.execute(delete(RateLimitBucket).where(RateLimitBucket.window_start_epoch < cutoff))


def enforce_distributed_bucket(
    bucket_key: str,
    *,
    max_requests: int,
    window_seconds: int,
) -> int:
    """
    Increment hit count for fixed window; return retry_after seconds if over limit.

    Raises nothing — caller maps return value > 0 to HTTP 429.
    """
    now = time.time()
    window_start = int(now // window_seconds) * window_seconds
    composite_key = f"{bucket_key}|{window_start}"

    db = SessionLocal()
    try:
        _prune_old_windows(db, window_seconds, now)
        for attempt in range(2):
            row = db.scalars(
                select(RateLimitBucket)
                .where(RateLimitBucket.bucket_key == composite_key)
                .with_for_update()
            ).first()
            if not row:
                row = RateLimitBucket(
                    bucket_key=composite_key,
                    window_start_epoch=window_start,
                    hit_count=0,
                    updated_at=_utcnow(),
                )
                db.add(row)
                try:
                    db.flush()
                except IntegrityError:
                    db.rollback()
                    if attempt == 0:
                        continue
                    raise
            row.hit_count += 1
            row.updated_at = _utcnow()
            if row.hit_count > max_requests:
                db.commit()
                oldest = window_start
                return max(1, int(window_seconds - (now - oldest)))
            db.commit()
            return 0
    except Exception:
        logger.exception("distributed_rate_limit_failed key=%s", bucket_key[:80])
        db.rollback()
        return 0
    finally:
        db.close()
    return 0
