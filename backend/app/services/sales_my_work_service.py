"""Sales Manager daily activity — derived from canonical sales records (no mock timeline)."""

from __future__ import annotations

from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from sqlalchemy import and_, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.manufacturing_workflow import SalesJobCard
from app.models.meeting import Meeting
from app.models.sales import (
    Customer,
    DispatchShipment,
    Lead,
    LeadActivity,
    Quotation,
    SalesOrder,
)
from app.models.security import AuditLog
from app.models.user import User
from app.schemas.sales_extended import SalesMyWorkActivityRead, SalesMyWorkRead
from app.services.sales_person_scope import sales_person_identity_candidates

_IST = ZoneInfo("Asia/Kolkata")
_CLOSED_LEAD = frozenset({"converted", "lost"})
_OPEN_QUOTE = frozenset({"draft", "sent"})
_TERMINAL_QUOTE = frozenset({"accepted", "rejected", "expired", "cancelled", "converted", "invoiced"})


def _parse_activity_date(value: str | None) -> date:
    if not value or not str(value).strip():
        return datetime.now(_IST).date()
    return date.fromisoformat(str(value).strip())


def _day_bounds(activity_date: date) -> tuple[datetime, datetime]:
    start = datetime.combine(activity_date, time.min, tzinfo=_IST)
    end = datetime.combine(activity_date, time.max, tzinfo=_IST)
    return start, end


def _local_date(dt: datetime | None) -> date | None:
    if not dt:
        return None
    if dt.tzinfo is None:
        return dt.date()
    return dt.astimezone(_IST).date()


def _time_label(dt: datetime | None) -> str | None:
    if not dt:
        return None
    local = dt.astimezone(_IST) if dt.tzinfo else dt
    label = local.strftime("%I:%M %p")
    return label.lstrip("0") if label.startswith("0") else label


def _user_matches_text(user: User, text: str | None) -> bool:
    if not text:
        return False
    raw = str(text).strip().lower()
    if not raw:
        return False
    for cand in sales_person_identity_candidates(user):
        lc = cand.lower()
        if raw == lc or lc in raw or raw in lc:
            return True
    return False


def _user_owns_sales_person(user: User, sales_person: str | None) -> bool:
    return _user_matches_text(user, sales_person)


def _audit_resource_index(audits: list[AuditLog]) -> dict[str, set[int]]:
    index: dict[str, set[int]] = {
        "lead": set(),
        "quotation": set(),
        "order": set(),
        "customer": set(),
        "job": set(),
    }
    for row in audits:
        res = (row.resource or "").lower()
        rid = row.resource_id
        if not rid:
            continue
        if "lead" in res:
            index["lead"].add(rid)
        if "quotation" in res or "quote" in res:
            index["quotation"].add(rid)
        if "order" in res:
            index["order"].add(rid)
        if "customer" in res:
            index["customer"].add(rid)
        if "job" in res:
            index["job"].add(rid)
    return index


def _user_own_work_record(
    user: User,
    sales_person: str | None,
    *,
    resource_kind: str,
    resource_id: int | None,
    audit_index: dict[str, set[int]],
) -> bool:
    """Personal work: assigned sales person or audit trail proves this user acted on the record."""
    if _user_owns_sales_person(user, sales_person):
        return True
    if resource_id is not None and resource_id in audit_index.get(resource_kind, set()):
        return True
    return False


def _activity(
    *,
    key: str,
    category: str,
    title: str,
    subtitle: str,
    status: str,
    view_path: str,
    occurred_at: datetime | None = None,
) -> SalesMyWorkActivityRead:
    return SalesMyWorkActivityRead(
        id=key,
        category=category,
        title=title,
        subtitle=subtitle,
        status=status,
        view_path=view_path,
        occurred_at=occurred_at.isoformat() if occurred_at else None,
        time_label=_time_label(occurred_at),
    )


def get_sales_my_work(
    db: Session,
    tenant_id: int,
    user: User,
    *,
    activity_date: str | None = None,
) -> SalesMyWorkRead:
    day = _parse_activity_date(activity_date)
    day_start, day_end = _day_bounds(day)
    items: list[SalesMyWorkActivityRead] = []
    seen: set[str] = set()

    audits = list(
        db.scalars(
            select(AuditLog).where(
                AuditLog.tenant_id == tenant_id,
                AuditLog.user_id == user.id,
                AuditLog.created_at >= day_start,
                AuditLog.created_at <= day_end,
            )
        ).all()
    )
    audit_index = _audit_resource_index(audits)
    quote_sent_ids = {
        row.resource_id
        for row in audits
        if row.resource_id
        and ("quotation" in (row.resource or "").lower() or "quote" in (row.resource or "").lower())
        and "send" in (row.action or "").lower()
    }

    def add(item: SalesMyWorkActivityRead) -> None:
        if item.id in seen:
            return
        seen.add(item.id)
        items.append(item)

    # --- Leads & follow-ups ---
    leads = list(
        db.scalars(
            select(Lead)
            .where(
                Lead.tenant_id == tenant_id,
                or_(
                    and_(Lead.created_at >= day_start, Lead.created_at <= day_end),
                    and_(Lead.updated_at >= day_start, Lead.updated_at <= day_end),
                    Lead.next_followup == day,
                ),
            )
            .options(selectinload(Lead.activities))
        ).all()
    )
    for lead in leads:
        if not _user_own_work_record(
            user,
            getattr(lead, "sales_executive", None),
            resource_kind="lead",
            resource_id=lead.id,
            audit_index=audit_index,
        ):
            continue
        name = lead.company or lead.name
        created_d = _local_date(lead.created_at)
        updated_d = _local_date(lead.updated_at)
        st = (lead.status or "").lower()
        if created_d == day:
            add(
                _activity(
                    key=f"lead-created-{lead.id}",
                    category="leads",
                    title="Lead Created",
                    subtitle=name,
                    status="completed" if st in _CLOSED_LEAD else "pending",
                    view_path=f"/sales/leads?lead={lead.id}",
                    occurred_at=lead.created_at,
                )
            )
        if updated_d == day and created_d != day:
            add(
                _activity(
                    key=f"lead-updated-{lead.id}",
                    category="leads",
                    title="Lead Updated",
                    subtitle=name,
                    status="completed" if st in _CLOSED_LEAD else "pending",
                    view_path=f"/sales/leads?lead={lead.id}",
                    occurred_at=lead.updated_at,
                )
            )
        if lead.next_followup == day:
            done_today = any(
                _local_date(a.created_at) == day
                and (a.activity_type or "").lower() in ("follow-up", "followup", "call", "meeting")
                for a in (lead.activities or [])
            )
            add(
                _activity(
                    key=f"lead-followup-{lead.id}-{day.isoformat()}",
                    category="followups",
                    title="Follow-up Completed" if done_today else "Follow-up Pending",
                    subtitle=name,
                    status="completed" if done_today else "pending",
                    view_path=f"/sales/leads?lead={lead.id}",
                    occurred_at=None,
                )
            )
        for act in lead.activities or []:
            if _local_date(act.created_at) != day:
                continue
            if not _user_matches_text(user, act.user_name):
                continue
            add(
                _activity(
                    key=f"lead-activity-{act.id}",
                    category="followups" if "follow" in (act.activity_type or "").lower() else "leads",
                    title=act.activity_type or "Lead Activity",
                    subtitle=act.subject or name,
                    status="completed",
                    view_path=f"/sales/leads?lead={lead.id}",
                    occurred_at=act.created_at,
                )
            )

    # --- Customers ---
    customers = list(
        db.scalars(
            select(Customer).where(
                Customer.tenant_id == tenant_id,
                or_(
                    and_(Customer.created_at >= day_start, Customer.created_at <= day_end),
                    and_(Customer.updated_at >= day_start, Customer.updated_at <= day_end),
                ),
            )
        ).all()
    )
    for cust in customers:
        if cust.id not in audit_index["customer"]:
            continue
        created_d = _local_date(cust.created_at)
        updated_d = _local_date(cust.updated_at)
        subtitle = cust.name or f"Customer #{cust.id}"
        path = f"/sales/customers/{cust.id}/edit"
        if created_d == day:
            add(
                _activity(
                    key=f"customer-created-{cust.id}",
                    category="customers",
                    title="Customer Created",
                    subtitle=subtitle,
                    status="completed",
                    view_path=path,
                    occurred_at=cust.created_at,
                )
            )
        elif updated_d == day:
            add(
                _activity(
                    key=f"customer-updated-{cust.id}-{day.isoformat()}",
                    category="customers",
                    title="Customer Updated",
                    subtitle=subtitle,
                    status="completed",
                    view_path=path,
                    occurred_at=cust.updated_at,
                )
            )

    # --- Quotations ---
    quotes = list(
        db.scalars(
            select(Quotation).where(
                Quotation.tenant_id == tenant_id,
                or_(
                    and_(Quotation.created_at >= day_start, Quotation.created_at <= day_end),
                    and_(Quotation.updated_at >= day_start, Quotation.updated_at <= day_end),
                ),
            )
        ).all()
    )
    for q in quotes:
        if not _user_own_work_record(
            user,
            q.sales_person,
            resource_kind="quotation",
            resource_id=q.id,
            audit_index=audit_index,
        ):
            continue
        created_d = _local_date(q.created_at)
        updated_d = _local_date(q.updated_at)
        qst = (q.status or "").lower()
        label = q.quote_number or f"Quote #{q.id}"
        if created_d == day:
            add(
                _activity(
                    key=f"quote-created-{q.id}",
                    category="quotations",
                    title="Quotation Created",
                    subtitle=label,
                    status="pending" if qst in _OPEN_QUOTE else "completed",
                    view_path=f"/sales/quotations/{q.id}",
                    occurred_at=q.created_at,
                )
            )
        if updated_d == day and created_d != day:
            quote_title = "Quotation Sent" if q.id in quote_sent_ids else "Quotation Updated"
            add(
                _activity(
                    key=f"quote-updated-{q.id}-{day.isoformat()}",
                    category="quotations",
                    title=quote_title,
                    subtitle=label,
                    status="completed" if qst in _TERMINAL_QUOTE else "pending",
                    view_path=f"/sales/quotations/{q.id}",
                    occurred_at=q.updated_at,
                )
            )

    # --- Sales orders ---
    orders = list(
        db.scalars(
            select(SalesOrder).where(
                SalesOrder.tenant_id == tenant_id,
                or_(
                    and_(SalesOrder.created_at >= day_start, SalesOrder.created_at <= day_end),
                    and_(SalesOrder.updated_at >= day_start, SalesOrder.updated_at <= day_end),
                ),
            )
        ).all()
    )
    for o in orders:
        if not _user_own_work_record(
            user,
            o.sales_person,
            resource_kind="order",
            resource_id=o.id,
            audit_index=audit_index,
        ):
            continue
        created_d = _local_date(o.created_at)
        updated_d = _local_date(o.updated_at)
        ost = (o.status or "").lower()
        subtitle = o.order_number or f"SO #{o.id}"
        if created_d == day:
            add(
                _activity(
                    key=f"so-created-{o.id}",
                    category="orders",
                    title="Sales Order Created",
                    subtitle=subtitle,
                    status="pending" if ost in ("draft", "pending") else "completed",
                    view_path=f"/sales/orders/{o.id}",
                    occurred_at=o.created_at,
                )
            )
        elif updated_d == day:
            add(
                _activity(
                    key=f"so-updated-{o.id}-{day.isoformat()}",
                    category="orders",
                    title="Sales Order Updated",
                    subtitle=subtitle,
                    status="completed" if ost in ("delivered", "closed", "completed") else "pending",
                    view_path=f"/sales/orders/{o.id}",
                    occurred_at=o.updated_at,
                )
            )

    # --- Job cards ---
    job_cards = list(
        db.scalars(
            select(SalesJobCard).where(
                SalesJobCard.tenant_id == tenant_id,
                or_(
                    and_(SalesJobCard.created_at >= day_start, SalesJobCard.created_at <= day_end),
                    and_(SalesJobCard.updated_at >= day_start, SalesJobCard.updated_at <= day_end),
                ),
            )
        ).all()
    )
    for jc in job_cards:
        owned = jc.created_by_user_id == user.id or jc.sales_person_id == user.id
        if not owned and not _user_own_work_record(
            user,
            jc.sales_person_name,
            resource_kind="job",
            resource_id=jc.id,
            audit_index=audit_index,
        ):
            continue
        created_d = _local_date(jc.created_at)
        updated_d = _local_date(jc.updated_at)
        subtitle = jc.job_card_no or f"JC #{jc.id}"
        path = f"/sales/job-cards/{jc.id}" if jc.id else "/my-job-cards?dept=sales"
        if created_d == day:
            add(
                _activity(
                    key=f"jc-created-{jc.id}",
                    category="job_cards",
                    title="Job Card Created",
                    subtitle=subtitle,
                    status="completed" if (jc.status or "") == "created" else "pending",
                    view_path=path,
                    occurred_at=jc.created_at,
                )
            )
        elif updated_d == day:
            add(
                _activity(
                    key=f"jc-updated-{jc.id}-{day.isoformat()}",
                    category="job_cards",
                    title="Job Card Updated",
                    subtitle=subtitle,
                    status="completed",
                    view_path=path,
                    occurred_at=jc.updated_at,
                )
            )

    # --- Dispatch (sales order attribution) ---
    dispatches = list(
        db.scalars(
            select(DispatchShipment)
            .where(
                DispatchShipment.tenant_id == tenant_id,
                DispatchShipment.dispatch_date == day,
            )
            .options(selectinload(DispatchShipment.sales_order))
        ).all()
    )
    for d in dispatches:
        so = d.sales_order
        if so and not _user_own_work_record(
            user,
            so.sales_person,
            resource_kind="order",
            resource_id=so.id,
            audit_index=audit_index,
        ):
            continue
        add(
            _activity(
                key=f"dispatch-{d.id}",
                category="orders",
                title="Dispatch Recorded",
                subtitle=d.dispatch_number or (so.order_number if so else "Shipment"),
                status="completed" if (d.status or "").lower() in ("delivered", "closed") else "pending",
                view_path="/sales/dispatch",
                occurred_at=d.created_at,
            )
        )

    # --- Meetings ---
    meetings = list(
        db.scalars(
            select(Meeting).where(
                Meeting.tenant_id == tenant_id,
                Meeting.meeting_date == day,
            )
        ).all()
    )
    for m in meetings:
        if m.created_by_user_id != user.id and not _user_matches_text(user, m.organizer):
            continue
        occurred = datetime.combine(m.meeting_date, m.start_time, tzinfo=_IST)
        add(
            _activity(
                key=f"meeting-{m.id}",
                category="meetings",
                title="Meeting",
                subtitle=m.title,
                status="completed" if (m.status or "").lower() in ("completed", "done") else "pending",
                view_path=f"/meetings/{m.id}",
                occurred_at=occurred,
            )
        )

    # --- Audit trail (sales module actions by this user on this day) ---
    for row in audits:
        res = (row.resource or "").lower()
        if not any(x in res for x in ("lead", "quotation", "quote", "order", "customer", "sales", "job")):
            continue
        rid = row.resource_id
        category = "leads"
        view_path = f"/sales/leads?lead={rid}" if rid else "/sales/leads"
        if "quotation" in res or "quote" in res:
            category = "quotations"
            view_path = f"/sales/quotations/{rid}" if rid else "/sales/quotations"
        elif "order" in res:
            category = "orders"
            view_path = f"/sales/orders/{rid}" if rid else "/sales/orders"
        elif "customer" in res:
            category = "customers"
            view_path = f"/sales/customers/{rid}/edit" if rid else "/sales/customers"
        elif "job" in res:
            category = "job_cards"
            view_path = f"/sales/job-cards/{rid}" if rid else "/my-job-cards?dept=sales"
        add(
            _activity(
                key=f"audit-{row.id}",
                category=category,
                title=(row.action or "Activity").replace("_", " ").title(),
                subtitle=row.resource or "Sales",
                status="completed",
                view_path=view_path,
                occurred_at=row.created_at,
            )
        )

    items.sort(key=lambda a: (a.occurred_at or "", a.id))

    completed = [i for i in items if i.status == "completed"]
    pending = [i for i in items if i.status == "pending"]

    return SalesMyWorkRead(
        activity_date=day.isoformat(),
        completed_count=len(completed),
        pending_count=len(pending),
        completed=completed,
        pending=pending,
        timeline=items,
    )
