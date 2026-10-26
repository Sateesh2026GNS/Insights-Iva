"""Buyer & Client CRM Tracker metrics, reminders, and access control."""

from datetime import date, datetime, timezone
from types import SimpleNamespace

from app.core.database import SessionLocal
from app.models.sales import Invoice, Lead, Quotation, SalesOrder
from app.services.crm_tracker_service import build_crm_tracker, inquiry_bucket, invoice_balance

TODAY = date(2026, 10, 23)


def _lead(**kwargs):
    data = dict(
        id=1,
        name="Ada",
        company_name="Harbor",
        company="Harbor",
        contact_person="Ada",
        email="ada@harbor.test",
        status="new",
        is_draft=False,
        expected_value=1000,
        opportunity_value=None,
        next_followup=None,
        notes="Call the buyer",
        requirement_details=None,
    )
    data.update(kwargs)
    return SimpleNamespace(**data)


def _customer(**kwargs):
    data = dict(
        id=1,
        company_name="Harbor",
        name="Harbor",
        contact_name="Ada",
        email="ada@harbor.test",
        phone="9998887799",
        customer_code="CL-1001",
        state="Maharashtra",
        status="active",
    )
    data.update(kwargs)
    return SimpleNamespace(**data)


def test_empty_tracker_has_no_fabricated_comparisons():
    tracker = build_crm_tracker(
        customers=[],
        leads=[],
        activities=[],
        last_contact_by_lead={},
        quotations=[],
        orders=[],
        invoices=[],
        reminders=[],
        reminders_available=True,
        today=TODAY,
    )
    assert tracker.header.total_clients == 0
    assert tracker.header.conversion_rate is None
    assert tracker.header.order_value == 0
    assert tracker.kpis[5].value == 0
    assert "percent" not in tracker.model_dump_json().lower()


def test_pipeline_counts_each_amount_once_and_followups_use_calendar_dates():
    leads = [
        _lead(id=1, status="new", expected_value=100, next_followup=date(2026, 10, 25)),
        _lead(id=2, status="qualified", expected_value=200, next_followup=date(2026, 10, 23)),
        _lead(id=3, status="contacted", expected_value=999, next_followup=date(2026, 10, 20)),
        _lead(id=4, status="converted", expected_value=500),
        _lead(id=5, status="new", is_draft=True, expected_value=50),
    ]
    quotes = [
        SimpleNamespace(id=1, lead_id=3, status="sent", total_amount=300),
        SimpleNamespace(id=2, lead_id=4, status="sent", total_amount=500),
    ]
    orders = [
        SimpleNamespace(status="confirmed", total_amount=800),
        SimpleNamespace(status="draft", total_amount=50),
        SimpleNamespace(status="cancelled", total_amount=70),
    ]
    invoices = [
        SimpleNamespace(customer_id=1, status="issued", invoice_status="active", payment_status="partial", grand_total=100, amount_paid=40),
        SimpleNamespace(customer_id=1, status="issued", invoice_status="cancelled", payment_status="unpaid", grand_total=90, amount_paid=0),
        SimpleNamespace(customer_id=1, status="issued", invoice_status="active", payment_status="paid", grand_total=20, amount_paid=0),
    ]
    tracker = build_crm_tracker(
        customers=[_customer()],
        leads=leads,
        activities=[
            SimpleNamespace(
                lead_id=1,
                activity_type="Call",
                subject="Intro call",
                created_at=datetime(2026, 10, 22, tzinfo=timezone.utc),
            )
        ],
        last_contact_by_lead={1: date(2026, 10, 22)},
        quotations=quotes,
        orders=orders,
        invoices=invoices,
        reminders=[SimpleNamespace(id=7, title="Send catalogue", notes=None, due_on=None, completed=False, customer_id=1)],
        reminders_available=True,
        today=TODAY,
    )
    stages = {row.label: row.value for row in tracker.pipeline}
    assert stages["Inquiry"] == 100
    assert stages["Quotation"] == 300
    assert stages["Negotiation"] == 200
    assert stages["Order Confirmed"] == 800
    assert tracker.header.order_value == 1400
    assert tracker.header.receivables == 60
    assert tracker.header.active_inquiries == 3
    assert tracker.header.conversion_rate == 25.0
    assert tracker.kpis[5].value == 3
    timings = {row.lead_id: row.timing for row in tracker.follow_ups}
    assert timings[1] == "upcoming"
    assert timings[2] == "today"
    assert timings[3] == "overdue"
    assert tracker.clients[0].region == "Maharashtra"
    assert tracker.clients[0].last_contact == date(2026, 10, 22)
    assert inquiry_bucket(leads[2], True) == "Quotation Sent"
    assert invoice_balance(invoices[1]) == 0


def test_blank_region_still_counts_the_client():
    tracker = build_crm_tracker(
        customers=[_customer(state=None, customer_code=None, id=4)],
        leads=[],
        activities=[],
        last_contact_by_lead={},
        quotations=[],
        orders=[],
        invoices=[],
        reminders=[],
        reminders_available=True,
        today=TODAY,
    )
    assert tracker.header.total_clients == 1
    assert tracker.by_region[0].label == "Not specified"
    assert tracker.clients[0].code == "CL-0004"


def test_tracker_api_customer_reminder_and_isolation(client, register_admin, make_restricted_user):
    admin = register_admin()
    empty = client.get("/sales/crm-tracker", headers=admin["headers"])
    assert empty.status_code == 200, empty.text
    assert empty.json()["header"]["total_clients"] == 0
    assert empty.json()["reminders_available"] is True

    created = client.post(
        "/sales/customers",
        headers=admin["headers"],
        json={
            "tenant_id": admin["user"]["tenant_id"],
            "name": "Harbor Metals",
            "company_name": "Harbor Metals",
            "email": "ada@harbor.test",
            "phone": "9998887799",
            "state": "Gujarat",
        },
    )
    assert created.status_code == 200, created.text
    customer_id = created.json()["id"]
    tenant_id = admin["user"]["tenant_id"]

    db = SessionLocal()
    try:
        db.add(
            Lead(
                tenant_id=tenant_id,
                name="Ada",
                company_name="Harbor Metals",
                email="ada@harbor.test",
                status="new",
                is_draft=False,
                expected_value=1000,
                next_followup=date(2026, 12, 1),
                notes="Discuss samples",
            )
        )
        db.add(
            Quotation(
                tenant_id=tenant_id,
                quote_number=f"QT-{tenant_id}-1",
                customer_id=customer_id,
                quote_date=date(2026, 10, 1),
                status="draft",
                total_amount=0,
            )
        )
        db.add(
            SalesOrder(
                tenant_id=tenant_id,
                customer_id=customer_id,
                order_number=f"SO-{tenant_id}-1",
                order_date=date(2026, 10, 2),
                status="confirmed",
                total_amount=250,
            )
        )
        db.add(
            Invoice(
                tenant_id=tenant_id,
                customer_id=customer_id,
                invoice_number=f"INV-{tenant_id}-1",
                issue_date=date(2026, 10, 3),
                status="issued",
                invoice_status="active",
                payment_status="unpaid",
                grand_total=80,
                amount_paid=30,
            )
        )
        db.commit()
        lead_id = db.query(Lead).filter(Lead.tenant_id == tenant_id).one().id
    finally:
        db.close()

    tracker = client.get("/sales/crm-tracker", headers=admin["headers"])
    assert tracker.status_code == 200, tracker.text
    body = tracker.json()
    assert body["header"]["total_clients"] == 1
    assert body["header"]["active_inquiries"] == 1
    assert body["header"]["receivables"] == 50
    stages = {row["label"]: row["value"] for row in body["pipeline"]}
    assert stages["Order Confirmed"] == 250
    assert stages["Inquiry"] == 1000

    reminder = client.post(
        "/sales/crm-reminders",
        headers=admin["headers"],
        json={"title": "Send catalogue", "customer_id": customer_id},
    )
    assert reminder.status_code == 201, reminder.text
    reminder_id = reminder.json()["id"]
    done = client.patch(
        f"/sales/crm-reminders/{reminder_id}",
        headers=admin["headers"],
        json={"completed": True},
    )
    assert done.status_code == 200, done.text
    listed = client.get("/sales/crm-tracker", headers=admin["headers"])
    assert listed.json()["reminders"] == []

    completed = client.post(f"/sales/crm-tracker/follow-ups/{lead_id}/complete", headers=admin["headers"])
    assert completed.status_code == 200, completed.text
    assert completed.json()["kpis"][5]["value"] == 0

    other = register_admin()
    isolated = client.get("/sales/crm-tracker", headers=other["headers"])
    assert isolated.json()["header"]["total_clients"] == 0

    limited = make_restricted_user(tenant_id, ["dashboard"])
    denied = client.get("/sales/crm-tracker", headers=limited["headers"])
    assert denied.status_code == 403
