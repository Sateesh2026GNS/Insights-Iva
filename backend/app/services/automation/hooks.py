"""Post-commit automation dispatch — isolated from primary ERP transactions."""

from __future__ import annotations

import logging

from app.core.database import SessionLocal
from app.services.automation.events import AutomationEvent

logger = logging.getLogger("gns_insights.automation.hooks")


def dispatch_automation_event_isolated(
    tenant_id: int,
    event_type: AutomationEvent | str,
    *,
    correlation_id: str | None = None,
) -> None:
    """Run matching automation rules in a fresh session; never raises to callers."""
    if not tenant_id:
        return
    db = SessionLocal()
    try:
        from app.services.automation.engine import dispatch_automation_event

        dispatch_automation_event(
            db,
            int(tenant_id),
            event_type,
            correlation_id=correlation_id,
        )
        db.commit()
    except Exception:
        logger.exception(
            "automation_dispatch_failed tenant_id=%s event=%s",
            tenant_id,
            event_type,
        )
        try:
            db.rollback()
        except Exception:
            pass
    finally:
        db.close()


def after_inventory_stock_sync(tenant_id: int) -> None:
    """Call after stock is persisted and low-stock alerts are synced."""
    dispatch_automation_event_isolated(tenant_id, AutomationEvent.STOCK_LOW)
    dispatch_automation_event_isolated(tenant_id, AutomationEvent.STOCK_CRITICAL)


def dispatch_workflow_status_automation(
    tenant_id: int,
    new_status: str,
    *,
    sales_order_id: int | None = None,
) -> None:
    """Map manufacturing workflow transitions to automation events."""
    status = (new_status or "").upper()
    correlation = f"so:{sales_order_id}:{status}" if sales_order_id else None
    mapping: dict[str, AutomationEvent] = {
        "MATERIAL_CHECK_PENDING": AutomationEvent.JOB_CARD_MATERIAL_CHECK_PENDING,
        "READY_FOR_PRODUCTION": AutomationEvent.JOB_CARD_SENT_TO_PRODUCTION,
        "QUALITY_CHECK_PENDING": AutomationEvent.QC_PENDING,
        "QUALITY_ON_HOLD": AutomationEvent.QC_PENDING,
        "SALES_CONFIRMED": AutomationEvent.SALES_ORDER_CONFIRMED,
    }
    event = mapping.get(status)
    if event:
        dispatch_automation_event_isolated(tenant_id, event, correlation_id=correlation)
