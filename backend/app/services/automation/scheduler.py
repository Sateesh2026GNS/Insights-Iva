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
_stop = threading.Event()
_thread: threading.Thread | None = None


def _interval_seconds() -> int:
    minutes = max(15, int(get_settings().automation_scheduler_interval_minutes or 360))
    return minutes * 60


def _run_all_tenants() -> None:
    if _stop.is_set():
        return
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
        if _stop.is_set():
            return
        tenant_ids = list(db.scalars(select(Tenant.id)).all())
        from app.services.automation.engine import run_scheduled_automations_for_tenant

        for tid in tenant_ids:
            if _stop.is_set():
                break
            try:
                run_scheduled_automations_for_tenant(db, int(tid))
            except Exception:
                logger.exception("scheduled_automation_failed tenant_id=%s", tid)
                db.rollback()
        if get_settings().automation_morning_summary_enabled and not _stop.is_set():
            try:
                from app.services.automation.morning_summary import run_morning_summary_delivery

                run_morning_summary_delivery(db)
            except Exception:
                logger.exception("morning_summary_tick_failed")
                db.rollback()
        if not _stop.is_set():
            try:
                from app.services.reports.schedules_service import run_due_schedules

                ran = run_due_schedules(db)
                if ran:
                    logger.info("report_schedules_executed count=%s", ran)
            except Exception:
                logger.exception("report_schedules_tick_failed")
                db.rollback()
    finally:
        if lock_held:
            from app.services.automation.scheduler_lock import release_scheduler_lock

            release_scheduler_lock(db)
        db.close()


def _scheduler_loop() -> None:
    # Interruptible startup delay so shutdown can complete quickly.
    if _stop.wait(60):
        return
    interval = _interval_seconds()
    while not _stop.is_set():
        try:
            logger.info("automation_scheduler_tick interval_seconds=%s", interval)
            _run_all_tenants()
        except Exception:
            logger.exception("automation_scheduler_tick_failed")
        if _stop.wait(interval):
            break
    logger.info("automation_scheduler_loop_exited")


def start_automation_scheduler() -> None:
    """Start background scheduler only when AUTOMATION_SCHEDULER_ENABLED=true."""
    global _started, _thread
    if not get_settings().automation_scheduler_enabled:
        logger.info("automation_scheduler_disabled (AUTOMATION_SCHEDULER_ENABLED is not true)")
        return
    with _lock:
        if _started:
            return
        _stop.clear()
        _started = True
        thread = threading.Thread(target=_scheduler_loop, name="automation-scheduler", daemon=True)
        _thread = thread
        thread.start()
    logger.info(
        "automation_scheduler_started interval_minutes=%s",
        get_settings().automation_scheduler_interval_minutes,
    )


def stop_automation_scheduler(*, join_timeout: float = 5.0) -> None:
    """Signal the scheduler loop to stop and wait briefly for a clean exit.

    Advisory locks held by an in-flight tick are released in ``_run_all_tenants``
    finally; remaining session locks drop when the DB connection closes.
    """
    global _started, _thread
    _stop.set()
    thread = None
    with _lock:
        thread = _thread
        _started = False
        _thread = None
    if thread is not None and thread.is_alive():
        thread.join(timeout=join_timeout)
        if thread.is_alive():
            logger.warning("automation_scheduler_stop_timeout still_alive=True")
        else:
            logger.info("automation_scheduler_stopped")
    else:
        logger.info("automation_scheduler_stopped")


def reset_automation_scheduler_for_tests() -> None:
    """Test helper — stops any loop, then clears flags so direct ticks can run again."""
    global _started, _thread
    _stop.set()
    with _lock:
        _started = False
        _thread = None
    # Allow subsequent unit tests to invoke ``_run_all_tenants`` / ``start_`` safely.
    _stop.clear()
