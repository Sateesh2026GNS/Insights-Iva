"""Business documents, e-waybill, digital signature, feature settings."""

from __future__ import annotations

import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_any_permission, require_permission
from app.models.business_documents import (
    AppFeatureSetting,
    BusinessDocument,
    DigitalSignatureProfile,
    EwaybillCredential,
)
from app.models.user import User
from app.schemas.business_documents import (
    BusinessDocumentCreate,
    BusinessDocumentListResponse,
    BusinessDocumentRead,
    BusinessDocumentUpdate,
    DigitalSignatureSetupRequest,
    DigitalSignatureStatusRead,
    EwaybillLoginRequest,
    EwaybillLoginResponse,
    EwaybillStatusRead,
    FeatureSettingRead,
    FeatureSettingUpdate,
)
from app.services.auth_service import hash_password

router = APIRouter(prefix="/biz", tags=["business-documents"])

DOC_PREFIX = {
    "payment_receipt": "PR",
    "refund_voucher": "RV",
    "proforma": "PI",
    "export_invoice": "EI",
    "export_proforma": "EPI",
    "delivery_challan": "DC",
    "credit_note": "CN",
    "debit_note": "DN",
    "e_invoice": "EINV",
    "purchase": "PUR",
    "payment_made": "PM",
    "purchase_debit_note": "PDN",
}


def _next_number(db: Session, tenant_id: int, doc_type: str) -> str:
    if doc_type == "purchase":
        from app.services.document_builder_service import allocate_next_purchase_number

        return allocate_next_purchase_number(db, tenant_id)
    from app.services.document_number_service import next_document_number_from_max

    prefix = DOC_PREFIX.get(doc_type, "DOC")
    return next_document_number_from_max(
        db,
        model=BusinessDocument,
        tenant_id=tenant_id,
        number_attr="document_number",
        prefix=prefix,
        width=5,
        extra_filters=(BusinessDocument.doc_type == doc_type,),
    )


@router.get("/documents", response_model=BusinessDocumentListResponse)
def list_documents(
    module: str | None = Query(None),
    doc_type: str | None = Query(None),
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=500),
    user: User = Depends(require_any_permission("sales", "procurement", "accounts", "settings", "admin")),
    db: Session = Depends(get_db),
):
    tenant_id = user.tenant_id
    stmt = select(BusinessDocument).where(BusinessDocument.tenant_id == tenant_id)
    if module:
        stmt = stmt.where(BusinessDocument.module == module)
    if doc_type:
        stmt = stmt.where(BusinessDocument.doc_type == doc_type)
    if search and search.strip():
        q = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(
                BusinessDocument.document_number.ilike(q),
                BusinessDocument.party_name.ilike(q),
            )
        )
    count_stmt = select(func.count()).select_from(stmt.order_by(None).subquery())
    total = int(db.scalar(count_stmt) or 0)
    rows = list(
        db.scalars(
            stmt.order_by(BusinessDocument.document_date.desc(), BusinessDocument.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        ).all()
    )
    return BusinessDocumentListResponse(
        items=[BusinessDocumentRead.model_validate(r) for r in rows],
        total=total,
    )


@router.post("/documents", response_model=BusinessDocumentRead)
def create_document(
    payload: BusinessDocumentCreate,
    user: User = Depends(require_any_permission("sales", "procurement", "accounts", "admin")),
    db: Session = Depends(get_db),
):
    if payload.tenant_id is not None and payload.tenant_id != user.tenant_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create business document for another tenant",
        )
    target_tenant_id = user.tenant_id
    doc_type = payload.doc_type
    number = payload.document_number or _next_number(db, target_tenant_id, doc_type)
    row = BusinessDocument(
        tenant_id=target_tenant_id,
        module=payload.module or "sales",
        doc_type=doc_type,
        document_number=number,
        party_name=payload.party_name,
        document_date=payload.document_date or date.today(),
        due_date=payload.due_date,
        amount=float(payload.amount or 0),
        status=payload.status or "draft",
        notes=payload.notes,
        meta_json=json.dumps(payload.meta) if payload.meta else None,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return BusinessDocumentRead.model_validate(row)


@router.get("/documents/{doc_id}", response_model=BusinessDocumentRead)
def get_document(
    doc_id: int,
    user: User = Depends(require_any_permission("sales", "procurement", "accounts")),
    db: Session = Depends(get_db),
):
    row = db.get(BusinessDocument, doc_id)
    if not row or row.tenant_id != user.tenant_id:
        raise HTTPException(404, "Document not found")
    return BusinessDocumentRead.model_validate(row)


@router.get("/documents/{doc_id}/document")
def get_purchase_document_endpoint(
    doc_id: int,
    user: User = Depends(require_any_permission("sales", "procurement", "accounts")),
    db: Session = Depends(get_db),
):
    from app.services.document_builder_service import build_purchase_document

    row = db.get(BusinessDocument, doc_id)
    if not row or row.tenant_id != user.tenant_id or row.doc_type != "purchase":
        raise HTTPException(404, "Purchase document not found")
    doc = build_purchase_document(db, user.tenant_id, doc_id)
    if not doc:
        raise HTTPException(404, "Purchase document not found")
    return doc


@router.get("/documents/{doc_id}/pdf")
def download_purchase_pdf_endpoint(
    doc_id: int,
    user: User = Depends(require_any_permission("sales", "procurement", "accounts")),
    db: Session = Depends(get_db),
):
    from fastapi.responses import Response

    from app.services.document_builder_service import build_purchase_document
    from app.services.invoice_pdf_service import generate_invoice_pdf

    row = db.get(BusinessDocument, doc_id)
    if not row or row.tenant_id != user.tenant_id or row.doc_type != "purchase":
        raise HTTPException(404, "Purchase document not found")
    doc = build_purchase_document(db, user.tenant_id, doc_id)
    if not doc:
        raise HTTPException(404, "Purchase document not found")
    pdf_bytes = generate_invoice_pdf(doc)
    doc_no = doc.get("meta", {}).get("document_no", str(doc_id))
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="Purchase-{doc_no}.pdf"'},
    )


@router.put("/documents/{doc_id}", response_model=BusinessDocumentRead)
def update_document(
    doc_id: int,
    payload: BusinessDocumentUpdate,
    user: User = Depends(require_any_permission("sales", "procurement", "accounts", "admin")),
    db: Session = Depends(get_db),
):
    row = db.get(BusinessDocument, doc_id)
    if not row or row.tenant_id != user.tenant_id:
        raise HTTPException(404, "Document not found")
    data = payload.model_dump(exclude_unset=True)
    if "meta" in data:
        meta = data.pop("meta")
        row.meta_json = json.dumps(meta) if meta is not None else None
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    return BusinessDocumentRead.model_validate(row)


@router.delete("/documents/{doc_id}")
def delete_document(
    doc_id: int,
    user: User = Depends(require_any_permission("sales", "procurement", "accounts", "admin")),
    db: Session = Depends(get_db),
):
    row = db.get(BusinessDocument, doc_id)
    if not row or row.tenant_id != user.tenant_id:
        raise HTTPException(404, "Document not found")
    db.delete(row)
    db.commit()
    return {"ok": True}


@router.get("/ewaybill/status", response_model=EwaybillStatusRead)
def ewaybill_status(
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(EwaybillCredential).where(EwaybillCredential.tenant_id == user.tenant_id)
    ).first()
    if not row:
        return EwaybillStatusRead()
    return EwaybillStatusRead(
        connected=bool(row.is_connected),
        gstin=row.gstin,
        username=row.username,
        last_login_at=row.last_login_at,
    )


@router.post("/ewaybill/login", response_model=EwaybillLoginResponse)
def ewaybill_login(
    payload: EwaybillLoginRequest,
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    gstin = payload.gstin.strip().upper()
    username = payload.username.strip()
    if len(gstin) < 15:
        raise HTTPException(400, "Invalid GSTIN")
    if not username or not payload.password:
        raise HTTPException(400, "Username and password required")

    row = db.scalars(
        select(EwaybillCredential).where(EwaybillCredential.tenant_id == user.tenant_id)
    ).first()
    if not row:
        row = EwaybillCredential(
            tenant_id=user.tenant_id,
            gstin=gstin,
            username=username,
            password_hash=hash_password(payload.password),
            is_connected=True,
            last_login_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        row.gstin = gstin
        row.username = username
        row.password_hash = hash_password(payload.password)
        row.is_connected = True
        row.last_login_at = datetime.utcnow()
    db.commit()
    return EwaybillLoginResponse(
        success=True,
        message="Logged in to E-Waybill System",
        connected=True,
        gstin=gstin,
    )


@router.post("/ewaybill/logout")
def ewaybill_logout(
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(EwaybillCredential).where(EwaybillCredential.tenant_id == user.tenant_id)
    ).first()
    if row:
        row.is_connected = False
        db.commit()
    return {"ok": True}


_EINVOICE_SETTING_KEY = "e_invoice_portal"


def _einvoice_setting(db: Session, tenant_id: int) -> dict:
    row = db.scalars(
        select(AppFeatureSetting).where(
            AppFeatureSetting.tenant_id == tenant_id,
            AppFeatureSetting.setting_key == _EINVOICE_SETTING_KEY,
        )
    ).first()
    if not row or not row.setting_value:
        return {}
    try:
        data = json.loads(row.setting_value)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _save_einvoice_setting(db: Session, tenant_id: int, data: dict) -> None:
    row = db.scalars(
        select(AppFeatureSetting).where(
            AppFeatureSetting.tenant_id == tenant_id,
            AppFeatureSetting.setting_key == _EINVOICE_SETTING_KEY,
        )
    ).first()
    raw = json.dumps(data)
    if not row:
        db.add(
            AppFeatureSetting(
                tenant_id=tenant_id,
                setting_key=_EINVOICE_SETTING_KEY,
                setting_value=raw,
            )
        )
    else:
        row.setting_value = raw
    db.commit()


@router.get("/einvoice/status", response_model=EwaybillStatusRead)
def einvoice_status(
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    data = _einvoice_setting(db, user.tenant_id)
    return EwaybillStatusRead(
        connected=bool(data.get("connected")),
        gstin=data.get("gstin"),
        username=data.get("username"),
        last_login_at=None,
    )


@router.post("/einvoice/login", response_model=EwaybillLoginResponse)
def einvoice_login(
    payload: EwaybillLoginRequest,
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    gstin = payload.gstin.strip().upper()
    username = payload.username.strip()
    if len(gstin) < 15:
        raise HTTPException(400, "Invalid GSTIN")
    if not username or not payload.password:
        raise HTTPException(400, "Username and password required")

    prev = _einvoice_setting(db, user.tenant_id)
    _save_einvoice_setting(
        db,
        user.tenant_id,
        {
            **prev,
            "connected": True,
            "gstin": gstin,
            "username": username,
            "password_hash": hash_password(payload.password),
            "last_login_at": datetime.utcnow().isoformat(),
        },
    )
    return EwaybillLoginResponse(
        success=True,
        message="Logged in to E-Invoice System",
        connected=True,
        gstin=gstin,
    )


@router.post("/einvoice/logout")
def einvoice_logout(
    user: User = Depends(require_permission("sales")),
    db: Session = Depends(get_db),
):
    data = _einvoice_setting(db, user.tenant_id)
    if data:
        data["connected"] = False
        _save_einvoice_setting(db, user.tenant_id, data)
    return {"ok": True}


@router.get("/digital-signature/status", response_model=DigitalSignatureStatusRead)
def digital_signature_status(
    user: User = Depends(require_any_permission("sales", "settings")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(DigitalSignatureProfile).where(
            DigitalSignatureProfile.tenant_id == user.tenant_id
        )
    ).first()
    if not row:
        return DigitalSignatureStatusRead(promo_credits=3)
    return DigitalSignatureStatusRead(
        is_setup=bool(row.is_setup),
        promo_credits=int(row.promo_credits or 0),
        signatory_name=row.signatory_name,
        aadhaar_masked=row.aadhaar_masked,
    )


@router.post("/digital-signature/setup", response_model=DigitalSignatureStatusRead)
def digital_signature_setup(
    payload: DigitalSignatureSetupRequest,
    user: User = Depends(require_any_permission("sales", "settings")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(DigitalSignatureProfile).where(
            DigitalSignatureProfile.tenant_id == user.tenant_id
        )
    ).first()
    masked = f"XXXX-XXXX-{payload.aadhaar_last4}"
    if not row:
        row = DigitalSignatureProfile(
            tenant_id=user.tenant_id,
            user_id=user.id,
            is_setup=True,
            promo_credits=3,
            signatory_name=payload.signatory_name.strip(),
            aadhaar_masked=masked,
            setup_at=datetime.utcnow(),
        )
        db.add(row)
    else:
        row.is_setup = True
        row.signatory_name = payload.signatory_name.strip()
        row.aadhaar_masked = masked
        row.setup_at = datetime.utcnow()
        row.user_id = user.id
    db.commit()
    db.refresh(row)
    return DigitalSignatureStatusRead(
        is_setup=True,
        promo_credits=int(row.promo_credits or 0),
        signatory_name=row.signatory_name,
        aadhaar_masked=row.aadhaar_masked,
    )


@router.get("/feature-settings/{key}", response_model=FeatureSettingRead)
def get_feature_setting(
    key: str,
    user: User = Depends(require_permission("settings")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(AppFeatureSetting).where(
            AppFeatureSetting.tenant_id == user.tenant_id,
            AppFeatureSetting.setting_key == key,
        )
    ).first()
    value = None
    if row and row.setting_value:
        try:
            value = json.loads(row.setting_value)
        except Exception:
            value = row.setting_value
    return FeatureSettingRead(key=key, value=value)


@router.put("/feature-settings/{key}", response_model=FeatureSettingRead)
def put_feature_setting(
    key: str,
    payload: FeatureSettingUpdate,
    user: User = Depends(require_permission("settings")),
    db: Session = Depends(get_db),
):
    row = db.scalars(
        select(AppFeatureSetting).where(
            AppFeatureSetting.tenant_id == user.tenant_id,
            AppFeatureSetting.setting_key == key,
        )
    ).first()
    raw = json.dumps(payload.value) if payload.value is not None else None
    if not row:
        row = AppFeatureSetting(
            tenant_id=user.tenant_id, setting_key=key, setting_value=raw
        )
        db.add(row)
    else:
        row.setting_value = raw
    db.commit()
    return FeatureSettingRead(key=key, value=payload.value)
