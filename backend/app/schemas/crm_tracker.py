"""Buyer & Client CRM Tracker response and reminder payloads."""

from datetime import date, datetime

from pydantic import BaseModel, Field


class CrmCountRead(BaseModel):
    label: str
    count: int = 0
    value: float | None = None


class CrmKpiRead(BaseModel):
    key: str
    label: str
    value: float | None = None
    note: str
    currency: str | None = None


class CrmHeaderRead(BaseModel):
    as_of: date
    total_clients: int = 0
    active_inquiries: int = 0
    order_value: float = 0
    receivables: float = 0
    conversion_rate: float | None = None
    currency: str


class CrmClientRead(BaseModel):
    id: int
    code: str
    name: str
    region: str
    client_type: str
    contact: str | None = None
    email: str | None = None
    phone: str | None = None
    status: str
    last_contact: date | None = None
    next_followup: date | None = None
    lead_id: int | None = None


class CrmLeadOptionRead(BaseModel):
    id: int
    name: str
    company: str | None = None
    status: str


class CrmInteractionRead(BaseModel):
    occurred_on: date | None = None
    client_name: str
    contact: str | None = None
    interaction_type: str
    subject: str
    next_action: str | None = None
    status: str


class CrmFollowUpRead(BaseModel):
    lead_id: int
    due_on: date
    client_name: str
    action: str
    due_label: str
    timing: str


class CrmReminderRead(BaseModel):
    id: int
    title: str
    notes: str | None = None
    due_on: date | None = None
    completed: bool = False
    customer_id: int | None = None
    client_name: str | None = None


class CrmTrackerRead(BaseModel):
    header: CrmHeaderRead
    kpis: list[CrmKpiRead]
    clients: list[CrmClientRead]
    leads: list[CrmLeadOptionRead]
    inquiry_status: list[CrmCountRead]
    inquiry_total: int = 0
    pipeline: list[CrmCountRead]
    interactions: list[CrmInteractionRead]
    by_region: list[CrmCountRead]
    receivables_by_client: list[CrmCountRead]
    follow_ups: list[CrmFollowUpRead]
    reminders: list[CrmReminderRead]
    reminders_available: bool = False
    currency: str


class CrmReminderCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)
    due_on: date | None = None
    customer_id: int | None = None


class CrmReminderUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    notes: str | None = Field(default=None, max_length=2000)
    due_on: date | None = None
    completed: bool | None = None
    customer_id: int | None = None
