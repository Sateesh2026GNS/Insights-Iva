import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.automation import AutomationRule
from app.services.automation.events import AutomationEvent

DEFAULT_RULES: list[dict] = [
    {
        "code": "low_stock_alert",
        "name": "Low Stock Alert",
        "description": "Notify Store Manager when inventory is at or below reorder level.",
        "event_type": AutomationEvent.STOCK_LOW,
    },
    {
        "code": "critical_stock_alert",
        "name": "Critical Stock Alert",
        "description": "Notify Store Manager when inventory is out of stock.",
        "event_type": AutomationEvent.STOCK_CRITICAL,
    },
    {
        "code": "followup_due",
        "name": "Follow-up Due",
        "description": "Remind sales users when a lead follow-up is due today.",
        "event_type": AutomationEvent.FOLLOWUP_DUE,
    },
    {
        "code": "followup_overdue",
        "name": "Overdue Follow-up",
        "description": "Escalate overdue lead follow-ups to sales users and managers.",
        "event_type": AutomationEvent.FOLLOWUP_OVERDUE,
    },
    {
        "code": "quotation_expiry",
        "name": "Quotation Expiry",
        "description": "Notify sales when a quotation is expiring soon.",
        "event_type": AutomationEvent.QUOTATION_EXPIRING,
        "config": {"days_before": 3},
    },
    {
        "code": "production_delay",
        "name": "Production Delay",
        "description": "Notify Production Manager when orders pass due date.",
        "event_type": AutomationEvent.PRODUCTION_DELAYED,
    },
    {
        "code": "qc_pending",
        "name": "QC Pending",
        "description": "Notify Quality Control when final inspection is pending.",
        "event_type": AutomationEvent.QC_PENDING,
    },
    {
        "code": "payment_due",
        "name": "Payment Due",
        "description": "Notify Accounts when customer invoices are due soon.",
        "event_type": AutomationEvent.INVOICE_DUE_SOON,
        "config": {"days_before": 7},
    },
    {
        "code": "payment_overdue",
        "name": "Payment Overdue",
        "description": "Notify Accounts when invoices are overdue.",
        "event_type": AutomationEvent.INVOICE_OVERDUE,
    },
    {
        "code": "maintenance_due",
        "name": "Maintenance Due",
        "description": "Notify maintenance when preventive tasks are due.",
        "event_type": AutomationEvent.MAINTENANCE_DUE,
    },
]


def ensure_default_automation_rules(db: Session, tenant_id: int) -> None:
    existing = {
        r.code
        for r in db.scalars(
            select(AutomationRule).where(AutomationRule.tenant_id == tenant_id)
        ).all()
    }
    for spec in DEFAULT_RULES:
        if spec["code"] in existing:
            continue
        cfg = spec.get("config")
        db.add(
            AutomationRule(
                tenant_id=tenant_id,
                code=spec["code"],
                name=spec["name"],
                description=spec.get("description"),
                event_type=spec["event_type"],
                enabled=True,
                config_json=json.dumps(cfg) if cfg else None,
            )
        )
    db.flush()
