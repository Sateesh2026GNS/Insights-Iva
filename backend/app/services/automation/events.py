"""Canonical automation event identifiers."""

from enum import Enum
class StrEnum(str, Enum):
    pass


class AutomationEvent(StrEnum):
    # Inventory
    STOCK_LOW = "stock.low"
    STOCK_CRITICAL = "stock.critical"
    # Sales
    LEAD_CREATED = "lead.created"
    FOLLOWUP_DUE = "followup.due"
    FOLLOWUP_OVERDUE = "followup.overdue"
    QUOTATION_CREATED = "quotation.created"
    QUOTATION_EXPIRING = "quotation.expiring"
    SALES_ORDER_CREATED = "sales_order.created"
    SALES_ORDER_CONFIRMED = "sales_order.confirmed"
    # Job cards / workflow
    JOB_CARD_CREATED = "job_card.created"
    JOB_CARD_SENT_TO_STORE = "job_card.sent_to_store"
    JOB_CARD_MATERIAL_CHECK_PENDING = "job_card.material_check_pending"
    JOB_CARD_SENT_TO_PRODUCTION = "job_card.sent_to_production"
    # Production
    PRODUCTION_ORDER_CREATED = "production_order.created"
    PRODUCTION_DELAYED = "production_order.delayed"
    WORK_ORDER_CREATED = "work_order.created"
    WORK_ORDER_OVERDUE = "work_order.overdue"
    PRODUCTION_COMPLETED = "production.completed"
    # Quality
    INSPECTION_PENDING = "inspection.pending"
    QC_FAILED = "qc.failed"
    QC_PASSED = "qc.passed"
    QC_PENDING = "final_qc.pending"
    # Accounts
    INVOICE_CREATED = "invoice.created"
    INVOICE_DUE_SOON = "invoice.due_soon"
    INVOICE_OVERDUE = "invoice.overdue"
    PAYMENT_RECEIVED = "payment.received"
    VENDOR_PAYMENT_DUE = "vendor_payment.due"
    # Maintenance
    MAINTENANCE_DUE = "maintenance.due"
    MAINTENANCE_OVERDUE = "maintenance.overdue"
    MACHINE_BREAKDOWN = "machine.breakdown"
