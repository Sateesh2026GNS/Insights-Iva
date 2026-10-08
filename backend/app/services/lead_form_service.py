"""Create-lead form: numbering, validation helpers, attachments."""

from __future__ import annotations

import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.product import Product
from app.models.sales import Lead, LeadActivity, LeadAttachment
from app.models.user import User
from app.schemas.lead_form import (
    LeadAttachmentRead,
    LeadDetailRead,
    LeadDiscussionRead,
    LeadDuplicateMatch,
    LeadFormCreate,
)

DISCUSSION_TYPE = "Discussion"

UPLOAD_ROOT = Path(__file__).resolve().parents[2] / "uploads" / "leads"
ALLOWED_EXT = {".pdf", ".png", ".jpg", ".jpeg", ".dxf", ".xlsx"}
MAX_BYTES = 10 * 1024 * 1024


def _status_key(value: str | None) -> str:
    clean = (value or "new").strip().lower()
    mapping = {
        "new": "new",
        "contacted": "contacted",
        "qualified": "qualified",
        "draft": "draft",
    }
    return mapping.get(clean, clean)


def _priority_key(value: str | None) -> str:
    clean = (value or "medium").strip().lower()
    if clean in ("high", "medium", "low"):
        return clean
    return "medium"


def peek_next_lead_no(db: Session, tenant_id: int) -> str:
    prefix = f"LD-{datetime.now().strftime('%y%m')}-"
    last = db.scalar(
        select(func.max(Lead.lead_no)).where(
            Lead.tenant_id == tenant_id,
            Lead.lead_no.isnot(None),
            Lead.lead_no.like(f"{prefix}%"),
        )
    )
    seq = 0
    if last:
        m = re.search(r"-(\d+)$", str(last))
        if m:
            seq = int(m.group(1))
    return f"{prefix}{seq + 1:05d}"


def allocate_lead_no(db: Session, tenant_id: int) -> str:
    for _ in range(5):
        candidate = peek_next_lead_no(db, tenant_id)
        exists = db.scalars(
            select(Lead.id).where(Lead.tenant_id == tenant_id, Lead.lead_no == candidate)
        ).first()
        if not exists:
            return candidate
        # race: bump by inserting a phantom count — re-query
        db.flush()
    raise HTTPException(status.HTTP_409_CONFLICT, "Could not allocate lead number.")


def check_lead_duplicates(
    db: Session,
    tenant_id: int,
    *,
    phone: str | None = None,
    gst_number: str | None = None,
) -> list[LeadDuplicateMatch]:
    clauses = []
    if phone and str(phone).strip():
        clean = re.sub(r"[\s\-]", "", str(phone).strip())
        clauses.append(func.replace(func.replace(Lead.phone, "-", ""), " ", "") == clean)
    if gst_number and str(gst_number).strip():
        clauses.append(func.upper(Lead.gst_number) == str(gst_number).strip().upper())
    if not clauses:
        return []
    stmt = select(Lead).where(Lead.tenant_id == tenant_id, or_(*clauses)).limit(5)
    rows = list(db.scalars(stmt).all())
    out = []
    for row in rows:
        out.append(
            LeadDuplicateMatch(
                id=row.id,
                lead_no=row.lead_no,
                company_name=row.company_name or row.company,
                contact_person=row.contact_person or row.name,
                phone=row.phone,
                gst_number=row.gst_number,
            )
        )
    return out


def _discussion_from_activity(row: LeadActivity) -> LeadDiscussionRead:
    subject = row.subject or ""
    role = None
    name = subject
    if " — " in subject:
        name, role = subject.rsplit(" — ", 1)
    return LeadDiscussionRead(
        id=row.id,
        discussed_with=name,
        role=role,
        details=row.notes,
        added_by=row.user_name,
        created_at=row.created_at.isoformat() if row.created_at else None,
    )


def assert_lead_product(db: Session, tenant_id: int, product_id: int | None) -> Product | None:
    if not product_id:
        return None
    product = db.scalars(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    ).first()
    if not product:
        raise HTTPException(400, "Invalid product for this tenant.")
    if str(product.status or "active").lower() not in ("active", ""):
        raise HTTPException(400, "Selected product is not active.")
    return product


def assert_lead_assignee(db: Session, tenant_id: int, assigned_user_id: int | None) -> User | None:
    if not assigned_user_id:
        return None
    assignee = db.scalars(
        select(User).where(User.id == assigned_user_id, User.tenant_id == tenant_id)
    ).first()
    if not assignee:
        raise HTTPException(400, "Assigned user not found.")
    return assignee


def serialize_lead_detail(lead: Lead, db: Session | None = None) -> LeadDetailRead:
    product_name = None
    assigned_name = None
    if db is not None:
        if lead.product_id:
            product = db.scalars(
                select(Product).where(
                    Product.id == lead.product_id, Product.tenant_id == lead.tenant_id
                )
            ).first()
            product_name = product.name if product else None
        if lead.assigned_user_id:
            assignee = db.scalars(
                select(User).where(
                    User.id == lead.assigned_user_id, User.tenant_id == lead.tenant_id
                )
            ).first()
            assigned_name = (assignee.full_name or assignee.email) if assignee else None
    discussions = [
        _discussion_from_activity(row)
        for row in sorted((lead.activities or []), key=lambda row: row.id or 0)
        if (row.activity_type or "").lower() == DISCUSSION_TYPE.lower()
    ]
    return LeadDetailRead(
        id=lead.id,
        tenant_id=lead.tenant_id,
        lead_no=lead.lead_no,
        company_name=lead.company_name or lead.company,
        contact_person=lead.contact_person or lead.name,
        phone=lead.phone,
        email=lead.email,
        city=lead.city,
        state=lead.state,
        address=lead.address,
        pincode=lead.pincode,
        gst_number=lead.gst_number,
        product_id=lead.product_id,
        product_name=product_name,
        quantity=float(lead.quantity) if lead.quantity is not None else None,
        expected_value=float(lead.expected_value or lead.opportunity_value or 0) or None,
        expected_close_date=lead.expected_close_date,
        requirement_details=lead.requirement_details,
        source=lead.source,
        status=lead.status,
        priority=lead.priority,
        assigned_user_id=lead.assigned_user_id,
        assigned_user_name=assigned_name or lead.sales_executive,
        next_follow_up=lead.next_followup,
        notes=lead.notes,
        is_draft=bool(lead.is_draft),
        attachments=[
            LeadAttachmentRead.model_validate(a) for a in (lead.attachments or [])
        ],
        discussions=discussions,
    )


def get_lead_detail(db: Session, tenant_id: int, lead_id: int) -> Lead | None:
    from sqlalchemy.orm import selectinload

    return db.scalars(
        select(Lead)
        .options(selectinload(Lead.attachments), selectinload(Lead.activities))
        .where(Lead.id == lead_id, Lead.tenant_id == tenant_id)
    ).first()


def create_lead_from_form(
    db: Session,
    tenant_id: int,
    user: User,
    payload: LeadFormCreate,
) -> Lead:
    company = (payload.company_name or payload.company or "").strip()
    contact = (payload.contact_person or payload.name or company or "Lead").strip()
    assert_lead_product(db, tenant_id, payload.product_id)
    assert_lead_assignee(db, tenant_id, payload.assigned_user_id)

    legacy_modal = bool((payload.name or "").strip()) and not (payload.company_name or "").strip()
    lead_no = None if payload.is_draft else (allocate_lead_no(db, tenant_id) if not legacy_modal else None)
    follow = payload.next_follow_up or payload.next_followup
    ev = payload.expected_value if payload.expected_value is not None else payload.opportunity_value

    lead = Lead(
        tenant_id=tenant_id,
        lead_no=lead_no,
        name=contact,
        company=company or None,
        company_name=company or None,
        contact_person=contact,
        phone=payload.phone,
        email=str(payload.email) if payload.email else None,
        city=payload.city,
        state=payload.state,
        address=(payload.address or "").strip() or None,
        pincode=payload.pincode,
        gst_number=payload.gst_number,
        source=payload.source,
        status="draft" if payload.is_draft else _status_key(payload.status),
        priority=_priority_key(payload.priority),
        notes=payload.notes,
        sales_executive=payload.sales_executive or (user.full_name or user.email),
        next_followup=follow,
        opportunity_value=ev,
        expected_value=ev,
        product_id=payload.product_id,
        quantity=payload.quantity,
        expected_close_date=payload.expected_close_date,
        requirement_details=payload.requirement_details,
        assigned_user_id=payload.assigned_user_id,
        is_draft=bool(payload.is_draft),
        created_by=user.id,
    )
    db.add(lead)
    db.flush()
    added_by = (user.full_name or user.email or "Sales").strip()
    for item in payload.discussions or []:
        person = (item.discussed_with or "").strip()
        role = (item.role or "").strip()
        subject = f"{person} — {role}" if role else person
        db.add(
            LeadActivity(
                tenant_id=tenant_id,
                lead_id=lead.id,
                activity_type=DISCUSSION_TYPE,
                subject=subject[:255],
                user_name=added_by,
                notes=(item.details or "").strip() or None,
            )
        )
    db.commit()
    db.refresh(lead)
    try:
        from app.services.automation.events import AutomationEvent
        from app.services.automation.hooks import dispatch_automation_event_isolated

        dispatch_automation_event_isolated(lead.tenant_id, AutomationEvent.LEAD_CREATED)
    except Exception:
        pass
    return lead


async def save_lead_attachments(
    db: Session,
    tenant_id: int,
    lead_id: int,
    user_id: int,
    files: list[UploadFile],
) -> list[LeadAttachment]:
    lead = get_lead_detail(db, tenant_id, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    UPLOAD_ROOT.mkdir(parents=True, exist_ok=True)
    saved: list[LeadAttachment] = []
    for upload in files:
        if not upload.filename:
            continue
        ext = Path(upload.filename).suffix.lower()
        if ext not in ALLOWED_EXT:
            raise HTTPException(400, f"File type not allowed: {ext}")
        data = await upload.read()
        if len(data) > MAX_BYTES:
            raise HTTPException(400, "Each attachment must be 10 MB or smaller.")
        safe_name = f"{uuid.uuid4().hex}{ext}"
        rel_path = f"leads/{tenant_id}/{lead_id}/{safe_name}"
        dest = UPLOAD_ROOT / str(tenant_id) / str(lead_id)
        dest.mkdir(parents=True, exist_ok=True)
        full = dest / safe_name
        full.write_bytes(data)
        row = LeadAttachment(
            tenant_id=tenant_id,
            lead_id=lead_id,
            file_name=upload.filename,
            file_path=rel_path,
            size=len(data),
            uploaded_by=user_id,
        )
        db.add(row)
        saved.append(row)
    if saved:
        db.commit()
        for row in saved:
            db.refresh(row)
    return saved


def _attachment_disk_path(row: LeadAttachment) -> Path:
    return UPLOAD_ROOT / str(row.tenant_id) / str(row.lead_id) / Path(row.file_path).name


def get_lead_attachment(
    db: Session, tenant_id: int, lead_id: int, attachment_id: int
) -> LeadAttachment:
    lead = get_lead_detail(db, tenant_id, lead_id)
    if not lead:
        raise HTTPException(404, "Lead not found")
    row = next((a for a in (lead.attachments or []) if a.id == attachment_id), None)
    if not row:
        raise HTTPException(404, "Attachment not found")
    return row


def delete_lead_attachment(
    db: Session, tenant_id: int, lead_id: int, attachment_id: int
) -> None:
    row = get_lead_attachment(db, tenant_id, lead_id, attachment_id)
    disk = _attachment_disk_path(row)
    db.delete(row)
    db.commit()
    try:
        if disk.is_file():
            disk.unlink()
    except OSError:
        pass
