"""In-process scheduler for tenant automation checks (no Celery/Redis)."""

import logging
import threading
import time

from sqlalchemy import select

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models.tenant import Tenant

logger = logging.getLogger("gns_insights.automation.scheduler")

_started = False
_lock = threading.Lock()


def _interval_seconds() -> int:
    minutes = max(15, int(get_settings().automation_scheduler_interval_minutes or 360))
    return minutes * 60


def _run_all_tenants() -> None:
    db = SessionLocal()
    lock_held = False
    try:
        from app.services.automation.scheduler_lock import (
            release_scheduler_lock,
            try_acquire_scheduler_lock,
        )

        if not try_acquire_scheduler_lock(db):
            logger.info("automation_scheduler_skipped advisory_lock_not_acquired")
            return
        lock_held = True
        tenant_ids = list(db.scalars(select(Tenant.id)).all())
        from app.services.automation.engine import run_scheduled_automations_for_tenant

        for tid in tenant_ids:
            try:
                run_scheduled_automations_for_tenant(db, int(tid))
            except Exception:
                logger.exception("scheduled_automation_failed tenant_id=%s", tid)
                db.rollback()
        if get_settings().automation_morning_summary_enabled:
            from app.services.automation.morning_summary import run_morning_summary_delivery

            run_morning_summary_delivery(db)
    finally:
        if lock_held:
            from app.services.automation.scheduler_lock import release_scheduler_lock

            release_scheduler_lock(db)
        db.close()


def _scheduler_loop() -> None:
    time.sleep(60)  # allow app startup
    interval = _interval_seconds()
    while True:
        try:
            logger.info("automation_scheduler_tick interval_seconds=%s", interval)
            _run_all_tenants()
        except Exception:
            logger.exception("automation_scheduler_tick_failed")
        time.sleep(interval)


def start_automation_scheduler() -> None:
    """Start background scheduler only when AUTOMATION_SCHEDULER_ENABLED=true."""
    global _started
    if not get_settings().automation_scheduler_enabled:
        logger.info("automation_scheduler_disabled (AUTOMATION_SCHEDULER_ENABLED is not true)")
        return
    with _lock:
        if _started:
            return
        _started = True
    thread = threading.Thread(target=_scheduler_loop, name="automation-scheduler", daemon=True)
    thread.start()
    logger.info(
        "automation_scheduler_started interval_minutes=%s",
        get_settings().automation_scheduler_interval_minutes,
    )


def reset_automation_scheduler_for_tests() -> None:
    """Test helper — does not stop a running thread."""
    global _started
    with _lock:
        _started = False
