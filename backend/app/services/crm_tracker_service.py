"""Buyer & Client CRM Tracker.

Metrics use persisted customers, leads, quotations, sales orders, invoices,
and lead activities. No historical percent change is returned.

Definitions
-----------
Total buyers / clients
    Count of customer rows for the tenant. There is no separate buyer type,
    so every customer is reported as Client.
Active inquiries
    Leads that are not drafts and whose status is not converted, won, or lost.
Converted orders
    Leads whose status is converted or won. Sales-order rows are not added
    again, so a converted inquiry is counted once.
Conversion rate
    Converted orders divided by non-draft leads. None when there are no
    non-draft leads.
Order pipeline
    Each amount is counted in one stage only:
    - Inquiry: open leads other than qualified, with no open quotation.
      Amount is expected_value, otherwise opportunity_value.
    - Quotation: quotations that are not cancelled, rejected, lost, accepted,
      converted, or invoiced, and whose lead is not already converted.
    - Negotiation: qualified leads with no open quotation, same amount rule.
    - Order confirmed: sales orders in confirmed, packed, shipped, or delivered.
    Header order value is the sum of those four stages.
Outstanding receivables
    Issued invoices that are not cancelled or drafts. Balance is
    grand_total minus amount_paid, and paid invoices contribute zero.
    Currency is INR because invoice amounts are stored without a currency
    code and GST documents in this ERP are rupee amounts.
Region
    Customer state. Blank state is "Not specified" and still counts in the
    client total. Customers do not have a country column.
Pending follow-ups
    Open leads with next_followup set. Timing uses the server calendar date:
    earlier dates are overdue, the same date is due today, later dates are
    upcoming.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, inspect, select
from sqlalchemy.orm import Session

from app.models.sales import (
    CrmReminder,
    Customer,
    Invoice,
    Lead,
    LeadActivity,
    Quotation,
    SalesOrder,
)
from app.schemas.crm_tracker import (
    CrmClientRead,
    CrmCountRead,
    CrmFollowUpRead,
    CrmHeaderRead,
    CrmInteractionRead,
    CrmKpiRead,
    CrmLeadOptionRead,
    CrmReminderCreate,
    CrmReminderRead,
    CrmReminderUpdate,
    CrmTrackerRead,
)

BOOKS_CURRENCY = "INR"
CLOSED_LEAD = frozenset({"converted", "won", "lost"})
CONVERTED_LEAD = frozenset({"converted", "won"})
CLOSED_QUOTE = frozenset({"cancelled", "canceled", "rejected", "lost", "accepted", "converted", "invoiced"})
CONFIRMED_ORDER = frozenset({"confirmed", "packed", "shipped", "delivered"})
INQUIRY_LABELS = ("New", "In Discussion", "Quotation Sent", "Negotiation")
PIPELINE_LABELS = ("Inquiry", "Quotation", "Negotiation", "Order Confirmed")
NOT_SPECIFIED = "Not specified"


def _norm(value) -> str:
    return " ".join(str(value or "").strip().lower().split())


def _money(value) -> float:
    return round(float(value or 0), 2)


def _lead_value(lead) -> float:
    expected = getattr(lead, "expected_value", None)
    if expected is not None:
        return _money(expected)
    return _money(getattr(lead, "opportunity_value", None))


def _lead_status(lead) -> str:
    return (getattr(lead, "status", None) or "").strip().lower()


def _is_open_lead(lead) -> bool:
    return not bool(getattr(lead, "is_draft", False)) and _lead_status(lead) not in CLOSED_LEAD


def _client_name(customer) -> str:
    return (getattr(customer, "company_name", None) or getattr(customer, "name", None) or "Unnamed client").strip()


def _region(customer) -> str:
    state = (getattr(customer, "state", None) or "").strip()
    return state or NOT_SPECIFIED


def inquiry_bucket(lead, has_open_quote: bool) -> str | None:
    """Map a lead onto the existing inquiry workflow. Converted leads are omitted."""
    status = _lead_status(lead)
    if status in CONVERTED_LEAD or bool(getattr(lead, "is_draft", False)):
        return None
    if status == "lost":
        return "Lost"
    if status in {"on_hold", "on hold", "hold"}:
        return "On Hold"
    if has_open_quote:
        return "Quotation Sent"
    if status == "qualified":
        return "Negotiation"
    if status == "contacted":
        return "In Discussion"
    if status == "new":
        return "New"
    return status.replace("_", " ").title() or "Other"


def invoice_balance(invoice) -> float:
    status = (getattr(invoice, "status", None) or "").strip().lower()
    lifecycle = (getattr(invoice, "invoice_status", None) or "").strip().lower()
    payment = (getattr(invoice, "payment_status", None) or "").strip().lower()
    if status in {"cancelled", "canceled", "draft", "void"} or lifecycle in {"cancelled", "canceled"}:
        return 0.0
    if payment == "paid":
        return 0.0
    return max(0.0, _money(getattr(invoice, "grand_total", None)) - _money(getattr(invoice, "amount_paid", None)))


def _due_label(due: date, today: date) -> tuple[str, str]:
    delta = (due - today).days
    if delta < 0:
        days = abs(delta)
        return ("overdue", f"{days} day overdue" if days == 1 else f"{days} days overdue")
    if delta == 0:
        return ("today", "Today")
    return ("upcoming", "in 1 day" if delta == 1 else f"in {delta} days")


def _open_quote_lead_ids(quotations, leads_by_id) -> tuple[set[int], float]:
    lead_ids: set[int] = set()
    total = 0.0
    for quote in quotations:
        status = (getattr(quote, "status", None) or "").strip().lower()
        if status in CLOSED_QUOTE:
            continue
        lead = leads_by_id.get(getattr(quote, "lead_id", None))
        if lead is not None and _lead_status(lead) in CONVERTED_LEAD:
            continue
        total += _money(getattr(quote, "total_amount", None))
        if getattr(quote, "lead_id", None):
            lead_ids.add(quote.lead_id)
    return lead_ids, round(total, 2)


def build_crm_tracker(
    *,
    customers,
    leads,
    activities,
    last_contact_by_lead,
    quotations,
    orders,
    invoices,
    reminders,
    reminders_available: bool,
    today: date | None = None,
) -> CrmTrackerRead:
    today = today or date.today()
    leads = list(leads or [])
    customers = list(customers or [])
    leads_by_id = {lead.id: lead for lead in leads}
    quoted_leads, quotation_value = _open_quote_lead_ids(quotations or [], leads_by_id)

    inquiry_value = 0.0
    negotiation_value = 0.0
    status_counts: dict[str, int] = {label: 0 for label in INQUIRY_LABELS}
    active_inquiries = 0
    converted = 0
    considered = 0
    for lead in leads:
        if bool(getattr(lead, "is_draft", False)):
            continue
        considered += 1
        status = _lead_status(lead)
        if status in CONVERTED_LEAD:
            converted += 1
        if _is_open_lead(lead):
            active_inquiries += 1
        bucket = inquiry_bucket(lead, lead.id in quoted_leads)
        if bucket:
            status_counts[bucket] = status_counts.get(bucket, 0) + 1
        if lead.id in quoted_leads or not _is_open_lead(lead):
            continue
        amount = _lead_value(lead)
        if status == "qualified":
            negotiation_value += amount
        else:
            inquiry_value += amount

    order_value = round(
        sum(
            _money(getattr(order, "total_amount", None))
            for order in (orders or [])
            if (getattr(order, "status", None) or "").strip().lower() in CONFIRMED_ORDER
        ),
        2,
    )
    pipeline = [
        CrmCountRead(label="Inquiry", value=round(inquiry_value, 2)),
        CrmCountRead(label="Quotation", value=round(quotation_value, 2)),
        CrmCountRead(label="Negotiation", value=round(negotiation_value, 2)),
        CrmCountRead(label="Order Confirmed", value=order_value),
    ]
    pipeline_total = round(sum(row.value or 0 for row in pipeline), 2)
    conversion_rate = round((converted / considered) * 100, 1) if considered else None

    by_email: dict[str, list] = {}
    by_company: dict[str, list] = {}
    for lead in leads:
        email = _norm(getattr(lead, "email", None))
        company = _norm(getattr(lead, "company_name", None) or getattr(lead, "company", None))
        if email:
            by_email.setdefault(email, []).append(lead)
        if company:
            by_company.setdefault(company, []).append(lead)

    def matched_leads(customer):
        found = by_email.get(_norm(getattr(customer, "email", None)), [])
        if found:
            return found
        return by_company.get(_norm(_client_name(customer)), [])

    client_rows = []
    region_counts: dict[str, int] = {}
    for customer in customers:
        region = _region(customer)
        region_counts[region] = region_counts.get(region, 0) + 1
        related = matched_leads(customer)
        followups = [lead.next_followup for lead in related if getattr(lead, "next_followup", None)]
        contacts = [
            last_contact_by_lead.get(lead.id)
            for lead in related
            if last_contact_by_lead.get(lead.id)
        ]
        primary = None
        if related:
            primary = sorted(related, key=lambda lead: (lead.next_followup or date.max, -lead.id))[0]
        client_rows.append(
            CrmClientRead(
                id=customer.id,
                code=(getattr(customer, "customer_code", None) or "").strip() or f"CL-{customer.id:04d}",
                name=_client_name(customer),
                region=region,
                client_type="Client",
                contact=(getattr(customer, "contact_name", None) or (getattr(primary, "contact_person", None) if primary else None) or None),
                email=getattr(customer, "email", None),
                phone=getattr(customer, "phone", None),
                status=(getattr(customer, "status", None) or "active").strip() or "active",
                last_contact=max(contacts) if contacts else None,
                next_followup=min(followups) if followups else None,
                lead_id=primary.id if primary else None,
            )
        )

    names = {customer.id: _client_name(customer) for customer in customers}
    receivable_totals: dict[str, float] = {}
    receivables = 0.0
    for invoice in invoices or []:
        balance = invoice_balance(invoice)
        if balance <= 0:
            continue
        receivables += balance
        label = names.get(getattr(invoice, "customer_id", None), "Unassigned")
        receivable_totals[label] = round(receivable_totals.get(label, 0) + balance, 2)
    receivables = round(receivables, 2)

    follow_ups = []
    for lead in leads:
        due = getattr(lead, "next_followup", None)
        if due is None or not _is_open_lead(lead):
            continue
        timing, label = _due_label(due, today)
        company = getattr(lead, "company_name", None) or getattr(lead, "company", None) or getattr(lead, "name", None) or "Lead"
        action = (getattr(lead, "notes", None) or getattr(lead, "requirement_details", None) or "Follow up").strip()
        follow_ups.append(
            CrmFollowUpRead(
                lead_id=lead.id,
                due_on=due,
                client_name=company,
                action=action[:180],
                due_label=label,
                timing=timing,
            )
        )
    follow_ups.sort(key=lambda row: row.due_on)

    interactions = []
    for activity in list(activities or [])[:8]:
        lead = leads_by_id.get(getattr(activity, "lead_id", None))
        occurred = getattr(activity, "created_at", None)
        occurred_on = occurred.date() if isinstance(occurred, datetime) else None
        next_action = None
        client_name = "Lead"
        contact = None
        status = "Open"
        if lead is not None:
            client_name = getattr(lead, "company_name", None) or getattr(lead, "company", None) or lead.name
            contact = getattr(lead, "contact_person", None) or lead.name
            status = _lead_status(lead).replace("_", " ").title() or "Open"
            if getattr(lead, "next_followup", None):
                next_action = f"Follow up {lead.next_followup.isoformat()}"
        interactions.append(
            CrmInteractionRead(
                occurred_on=occurred_on,
                client_name=client_name,
                contact=contact,
                interaction_type=(getattr(activity, "activity_type", None) or "Note").strip(),
                subject=(getattr(activity, "subject", None) or "").strip() or "Interaction",
                next_action=next_action,
                status=status,
            )
        )

    reminder_rows = []
    for reminder in reminders or []:
        if getattr(reminder, "completed", False):
            continue
        reminder_rows.append(
            CrmReminderRead(
                id=reminder.id,
                title=reminder.title,
                notes=getattr(reminder, "notes", None),
                due_on=getattr(reminder, "due_on", None),
                completed=False,
                customer_id=getattr(reminder, "customer_id", None),
                client_name=names.get(getattr(reminder, "customer_id", None)),
            )
        )

    inquiry_rows = [CrmCountRead(label=label, count=status_counts.get(label, 0)) for label in INQUIRY_LABELS]
    for label, count in status_counts.items():
        if label not in INQUIRY_LABELS and count:
            inquiry_rows.append(CrmCountRead(label=label, count=count))

    return CrmTrackerRead(
        header=CrmHeaderRead(
            as_of=today,
            total_clients=len(customers),
            active_inquiries=active_inquiries,
            order_value=pipeline_total,
            receivables=receivables,
            conversion_rate=conversion_rate,
            currency=BOOKS_CURRENCY,
        ),
        kpis=[
            CrmKpiRead(key="clients", label="Total Buyers / Clients", value=len(customers), note="Customer records"),
            CrmKpiRead(key="inquiries", label="Active Inquiries", value=active_inquiries, note="Open leads, excluding converted and lost"),
            CrmKpiRead(key="converted", label="Converted Orders", value=converted, note="Leads marked converted or won"),
            CrmKpiRead(
                key="pipeline",
                label="Order Pipeline Value",
                value=pipeline_total,
                note="Each amount is counted in one stage",
                currency=BOOKS_CURRENCY,
            ),
            CrmKpiRead(
                key="receivables",
                label="Outstanding Receivables",
                value=receivables,
                note="Unpaid invoice balance",
                currency=BOOKS_CURRENCY,
            ),
            CrmKpiRead(
                key="followups",
                label="Pending Follow-ups",
                value=len(follow_ups),
                note="Open leads with a follow-up date",
            ),
        ],
        clients=client_rows,
        leads=[
            CrmLeadOptionRead(
                id=lead.id,
                name=getattr(lead, "contact_person", None) or lead.name,
                company=getattr(lead, "company_name", None) or getattr(lead, "company", None),
                status=_lead_status(lead) or "new",
            )
            for lead in leads
            if _is_open_lead(lead)
        ][:100],
        inquiry_status=inquiry_rows,
        inquiry_total=active_inquiries,
        pipeline=pipeline,
        interactions=interactions,
        by_region=[CrmCountRead(label=label, count=count) for label, count in sorted(region_counts.items())],
        receivables_by_client=[
            CrmCountRead(label=label, value=value)
            for label, value in sorted(receivable_totals.items(), key=lambda item: item[1], reverse=True)[:8]
        ],
        follow_ups=follow_ups[:8],
        reminders=reminder_rows[:12],
        reminders_available=reminders_available,
        currency=BOOKS_CURRENCY,
    )


def _reminders_available(db: Session) -> bool:
    try:
        return inspect(db.get_bind()).has_table(CrmReminder.__tablename__)
    except Exception:
        return False


def get_crm_tracker(db: Session, tenant_id: int) -> CrmTrackerRead:
    customers = list(db.scalars(select(Customer).where(Customer.tenant_id == tenant_id).order_by(Customer.id.desc())).all())
    leads = list(db.scalars(select(Lead).where(Lead.tenant_id == tenant_id)).all())
    quotations = list(
        db.scalars(select(Quotation).where(Quotation.tenant_id == tenant_id)).all()
    )
    orders = list(db.scalars(select(SalesOrder).where(SalesOrder.tenant_id == tenant_id)).all())
    invoices = list(db.scalars(select(Invoice).where(Invoice.tenant_id == tenant_id)).all())
    activities = list(
        db.scalars(
            select(LeadActivity)
            .where(LeadActivity.tenant_id == tenant_id)
            .order_by(LeadActivity.id.desc())
            .limit(8)
        ).all()
    )
    last_contact_rows = db.execute(
        select(LeadActivity.lead_id, func.max(LeadActivity.created_at))
        .where(LeadActivity.tenant_id == tenant_id)
        .group_by(LeadActivity.lead_id)
    ).all()
    last_contact = {}
    for lead_id, stamp in last_contact_rows:
        if isinstance(stamp, datetime):
            last_contact[lead_id] = stamp.date()
        elif isinstance(stamp, date):
            last_contact[lead_id] = stamp
    available = _reminders_available(db)
    reminders = []
    if available:
        reminders = list(
            db.scalars(
                select(CrmReminder)
                .where(CrmReminder.tenant_id == tenant_id, CrmReminder.completed.is_(False))
                .order_by(CrmReminder.id.desc())
                .limit(12)
            ).all()
        )
    return build_crm_tracker(
        customers=customers,
        leads=leads,
        activities=activities,
        last_contact_by_lead=last_contact,
        quotations=quotations,
        orders=orders,
        invoices=invoices,
        reminders=reminders,
        reminders_available=available,
    )


def complete_crm_follow_up(db: Session, tenant_id: int, lead_id: int, user) -> CrmTrackerRead:
    lead = db.scalars(select(Lead).where(Lead.id == lead_id, Lead.tenant_id == tenant_id)).first()
    if lead is None or lead.next_followup is None:
        raise HTTPException(status_code=404, detail="Follow-up not found")
    if not _is_open_lead(lead):
        raise HTTPException(status_code=400, detail="This lead is already closed")
    lead.next_followup = None
    db.add(
        LeadActivity(
            tenant_id=tenant_id,
            lead_id=lead.id,
            activity_type="Follow-up",
            subject="Follow-up completed",
            user_name=(getattr(user, "full_name", None) or getattr(user, "email", None) or "Sales"),
            notes=None,
        )
    )
    db.commit()
    return get_crm_tracker(db, tenant_id)


def _customer_in_tenant(db: Session, tenant_id: int, customer_id: int | None) -> None:
    if customer_id is None:
        return
    customer = db.scalars(select(Customer).where(Customer.id == customer_id, Customer.tenant_id == tenant_id)).first()
    if customer is None:
        raise HTTPException(status_code=400, detail="Client not found")


def create_crm_reminder(db: Session, tenant_id: int, payload: CrmReminderCreate, user) -> CrmReminderRead:
    if not _reminders_available(db):
        raise HTTPException(status_code=503, detail="CRM reminders are not available until the reminder migration is applied")
    _customer_in_tenant(db, tenant_id, payload.customer_id)
    row = CrmReminder(
        tenant_id=tenant_id,
        customer_id=payload.customer_id,
        title=payload.title.strip(),
        notes=(payload.notes or "").strip() or None,
        due_on=payload.due_on,
        completed=False,
        created_by=getattr(user, "id", None),
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    client_name = None
    if row.customer_id:
        customer = db.get(Customer, row.customer_id)
        client_name = _client_name(customer) if customer else None
    return CrmReminderRead(
        id=row.id,
        title=row.title,
        notes=row.notes,
        due_on=row.due_on,
        completed=row.completed,
        customer_id=row.customer_id,
        client_name=client_name,
    )


def update_crm_reminder(db: Session, tenant_id: int, reminder_id: int, payload: CrmReminderUpdate) -> CrmReminderRead:
    if not _reminders_available(db):
        raise HTTPException(status_code=503, detail="CRM reminders are not available until the reminder migration is applied")
    row = db.scalars(select(CrmReminder).where(CrmReminder.id == reminder_id, CrmReminder.tenant_id == tenant_id)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    data = payload.model_dump(exclude_unset=True)
    if "customer_id" in data:
        _customer_in_tenant(db, tenant_id, data["customer_id"])
    if "title" in data and data["title"] is not None:
        row.title = data["title"].strip()
    if "notes" in data:
        row.notes = (data["notes"] or "").strip() or None
    if "due_on" in data:
        row.due_on = data["due_on"]
    if "customer_id" in data:
        row.customer_id = data["customer_id"]
    if "completed" in data and data["completed"] is not None:
        row.completed = bool(data["completed"])
        row.completed_at = datetime.now(timezone.utc) if row.completed else None
    db.commit()
    db.refresh(row)
    client_name = None
    if row.customer_id:
        customer = db.get(Customer, row.customer_id)
        client_name = _client_name(customer) if customer else None
    return CrmReminderRead(
        id=row.id,
        title=row.title,
        notes=row.notes,
        due_on=row.due_on,
        completed=row.completed,
        customer_id=row.customer_id,
        client_name=client_name,
    )


def delete_crm_reminder(db: Session, tenant_id: int, reminder_id: int) -> None:
    if not _reminders_available(db):
        raise HTTPException(status_code=503, detail="CRM reminders are not available until the reminder migration is applied")
    row = db.scalars(select(CrmReminder).where(CrmReminder.id == reminder_id, CrmReminder.tenant_id == tenant_id)).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(row)
    db.commit()
