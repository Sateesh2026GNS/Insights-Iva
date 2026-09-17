"""Document library business logic."""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.models.department import Department
from app.models.erp_document import (
    DocumentStatus,
    ErpDocument,
    ErpDocumentApproval,
    ErpDocumentVersion,
)
from app.models.user import User
from app.services.documents.scope import (
    resolve_accessible_department_ids,
    user_can_access_hr_documents,
    user_can_delete_documents,
)
from app.services.documents.storage import save_document_bytes

STATUS_TRANSITIONS: dict[str, set[str]] = {
    DocumentStatus.draft.value: {
        DocumentStatus.pending_approval.value,
        DocumentStatus.approved.value,
        DocumentStatus.archived.value,
    },
    DocumentStatus.pending_approval.value: {
        DocumentStatus.approved.value,
        DocumentStatus.draft.value,
        DocumentStatus.archived.value,
    },
    DocumentStatus.approved.value: {DocumentStatus.archived.value},
    DocumentStatus.archived.value: set(),
}


def _normalize_name(name: str) -> str:
    return (name or "").strip().lower()


def _base_query(db: Session, tenant_id: int, user: User):
    dept_ids = resolve_accessible_department_ids(db, tenant_id, user, None)
    if not dept_ids:
        return select(ErpDocument).where(False)
    q = select(ErpDocument).where(
        ErpDocument.tenant_id == tenant_id,
        ErpDocument.is_deleted.is_(False),
        ErpDocument.department_id.in_(dept_ids),
    )
    if not user_can_access_hr_documents(user):
        q = q.where(ErpDocument.category != "hr")
    return q


def find_duplicate(
    db: Session,
    tenant_id: int,
    name: str,
    category: str,
    department_id: int,
) -> ErpDocument | None:
    norm = _normalize_name(name)
    return db.scalar(
        select(ErpDocument).where(
            ErpDocument.tenant_id == tenant_id,
            ErpDocument.name_normalized == norm,
            ErpDocument.category == category,
            ErpDocument.department_id == department_id,
            ErpDocument.is_deleted.is_(False),
            ErpDocument.status != DocumentStatus.archived.value,
        )
    )


def list_documents(
    db: Session,
    user: User,
    *,
    category: str | None = None,
    department_id: int | None = None,
    uploaded_by: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    file_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = 1,
    page_size: int = 50,
    sort_dir: str = "desc",
) -> dict:
    tenant_id = user.tenant_id
    dept_filter = [department_id] if department_id else None
    dept_ids = resolve_accessible_department_ids(db, tenant_id, user, dept_filter)
    if not dept_ids or (department_id and department_id not in dept_ids):
        return {"items": [], "pagination": {"page": page, "page_size": page_size, "total_rows": 0}}

    q = _base_query(db, tenant_id, user)
    if category:
        q = q.where(ErpDocument.category == category)
    if dept_ids:
        q = q.where(ErpDocument.department_id.in_(dept_ids))
    if status:
        q = q.where(ErpDocument.status == status)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(ErpDocument.name.ilike(like))
    if date_from:
        q = q.where(ErpDocument.created_at >= datetime.combine(date_from, datetime.min.time()).replace(tzinfo=timezone.utc))
    if date_to:
        q = q.where(ErpDocument.created_at <= datetime.combine(date_to, datetime.max.time()).replace(tzinfo=timezone.utc))

    if uploaded_by or file_type:
        q = q.join(ErpDocumentVersion, ErpDocument.current_version_id == ErpDocumentVersion.id)
        if uploaded_by:
            q = q.where(ErpDocumentVersion.uploaded_by == uploaded_by)
        if file_type:
            q = q.where(ErpDocumentVersion.file_type == file_type)

    count_q = select(func.count()).select_from(q.subquery())
    total = int(db.scalar(count_q) or 0)

    order = ErpDocument.created_at.desc() if sort_dir != "asc" else ErpDocument.created_at.asc()
    q = q.order_by(order).offset((page - 1) * page_size).limit(page_size)
    docs = list(db.scalars(q).all())
    items = [_serialize_document(db, d) for d in docs]
    return {
        "items": items,
        "pagination": {"page": page, "page_size": page_size, "total_rows": total},
    }


def document_summary(db: Session, user: User, filters: dict) -> dict:
    listed = list_documents(db, user, page=1, page_size=10_000, **filters)
    items = listed["items"]
    recent_cutoff = datetime.now(timezone.utc) - timedelta(days=7)
    by_type = {"pdf": 0, "image": 0, "excel": 0, "word": 0}
    storage = 0
    recent = 0
    for row in items:
        ft = row.get("file_type")
        if ft in by_type:
            by_type[ft] += 1
        storage += int(row.get("file_size_bytes") or 0)
        created = row.get("created_at")
        if created:
            try:
                dt = datetime.fromisoformat(created.replace("Z", "+00:00"))
                if dt >= recent_cutoff:
                    recent += 1
            except ValueError:
                pass
    return {
        "total_documents": len(items),
        "pdf_files": by_type["pdf"],
        "image_files": by_type["image"],
        "excel_files": by_type["excel"],
        "word_files": by_type["word"],
        "recent_uploads_7d": recent,
        "storage_used_bytes": storage,
    }


def _serialize_document(db: Session, doc: ErpDocument) -> dict:
    ver = db.get(ErpDocumentVersion, doc.current_version_id) if doc.current_version_id else None
    dept = db.get(Department, doc.department_id)
    uploader = db.get(User, ver.uploaded_by) if ver else None
    creator = db.get(User, doc.created_by)
    return {
        "id": doc.id,
        "name": doc.name,
        "category": doc.category,
        "department_id": doc.department_id,
        "department_name": dept.name if dept else None,
        "status": doc.status,
        "version_number": ver.version_number if ver else 0,
        "file_type": ver.file_type if ver else None,
        "file_size_bytes": ver.file_size_bytes if ver else 0,
        "uploaded_by": ver.uploaded_by if ver else None,
        "uploaded_by_name": (uploader.full_name or uploader.email) if uploader else None,
        "created_by_name": (creator.full_name or creator.email) if creator else None,
        "created_at": doc.created_at.isoformat() if doc.created_at else None,
        "upload_note": ver.upload_note if ver else None,
    }


def get_document(db: Session, user: User, document_id: int) -> ErpDocument:
    doc = db.get(ErpDocument, document_id)
    if not doc or doc.tenant_id != user.tenant_id or doc.is_deleted:
        raise HTTPException(status_code=404, detail="Document not found")
    if doc.category == "hr" and not user_can_access_hr_documents(user):
        raise HTTPException(status_code=403, detail="HR documents are restricted")
    dept_ids = resolve_accessible_department_ids(db, user.tenant_id, user, [doc.department_id])
    if doc.department_id not in dept_ids:
        raise HTTPException(status_code=403, detail="Department access denied")
    return doc


def create_document_with_file(
    db: Session,
    user: User,
    *,
    name: str,
    category: str,
    department_id: int,
    file_bytes: bytes,
    filename: str,
    upload_note: str | None,
) -> dict:
    if category == "hr" and not user_can_access_hr_documents(user):
        raise HTTPException(status_code=403, detail="Only HR or Admin may upload HR documents")
    dept_ids = resolve_accessible_department_ids(db, user.tenant_id, user, [department_id])
    if department_id not in dept_ids:
        raise HTTPException(status_code=400, detail="Invalid department")
    if find_duplicate(db, user.tenant_id, name, category, department_id):
        raise HTTPException(
            status_code=409,
            detail="A document with this name already exists in this category and department. Upload a new version instead.",
        )

    doc = ErpDocument(
        tenant_id=user.tenant_id,
        name=name.strip(),
        name_normalized=_normalize_name(name),
        category=category,
        department_id=department_id,
        status=DocumentStatus.draft.value,
        created_by=user.id,
    )
    db.add(doc)
    db.flush()

    rel, ft, size = save_document_bytes(user.tenant_id, doc.id, 1, filename, file_bytes)
    ver = ErpDocumentVersion(
        document_id=doc.id,
        version_number=1,
        file_path=rel,
        file_type=ft,
        file_size_bytes=size,
        original_filename=filename,
        uploaded_by=user.id,
        upload_note=upload_note,
    )
    db.add(ver)
    db.flush()
    doc.current_version_id = ver.id
    db.commit()
    db.refresh(doc)
    return _serialize_document(db, doc)


def add_document_version(
    db: Session,
    user: User,
    document_id: int,
    file_bytes: bytes,
    filename: str,
    upload_note: str | None,
) -> dict:
    doc = get_document(db, user, document_id)
    max_v = db.scalar(
        select(func.max(ErpDocumentVersion.version_number)).where(
            ErpDocumentVersion.document_id == doc.id
        )
    ) or 0
    next_v = int(max_v) + 1
    rel, ft, size = save_document_bytes(user.tenant_id, doc.id, next_v, filename, file_bytes)
    ver = ErpDocumentVersion(
        document_id=doc.id,
        version_number=next_v,
        file_path=rel,
        file_type=ft,
        file_size_bytes=size,
        original_filename=filename,
        uploaded_by=user.id,
        upload_note=upload_note,
    )
    db.add(ver)
    db.flush()
    doc.current_version_id = ver.id
    db.commit()
    db.refresh(doc)
    return _serialize_document(db, doc)


def list_versions(db: Session, user: User, document_id: int) -> list[dict]:
    doc = get_document(db, user, document_id)
    rows = db.scalars(
        select(ErpDocumentVersion)
        .where(ErpDocumentVersion.document_id == doc.id)
        .order_by(ErpDocumentVersion.version_number.desc())
    ).all()
    out = []
    for v in rows:
        u = db.get(User, v.uploaded_by)
        out.append(
            {
                "id": v.id,
                "version_number": v.version_number,
                "file_type": v.file_type,
                "file_size_bytes": v.file_size_bytes,
                "original_filename": v.original_filename,
                "uploaded_by": v.uploaded_by,
                "uploaded_by_name": (u.full_name or u.email) if u else None,
                "upload_note": v.upload_note,
                "created_at": v.created_at.isoformat() if v.created_at else None,
                "is_current": v.id == doc.current_version_id,
            }
        )
    return out


def get_version_for_download(
    db: Session,
    user: User,
    document_id: int,
    version_number: int | None,
) -> ErpDocumentVersion:
    doc = get_document(db, user, document_id)
    if version_number:
        ver = db.scalar(
            select(ErpDocumentVersion).where(
                ErpDocumentVersion.document_id == doc.id,
                ErpDocumentVersion.version_number == version_number,
            )
        )
    else:
        ver = db.get(ErpDocumentVersion, doc.current_version_id) if doc.current_version_id else None
    if not ver:
        raise HTTPException(status_code=404, detail="Version not found")
    return ver


def transition_status(
    db: Session,
    user: User,
    document_id: int,
    new_status: str,
    note: str | None,
) -> dict:
    doc = get_document(db, user, document_id)
    if new_status not in {s.value for s in DocumentStatus}:
        raise HTTPException(status_code=400, detail="Invalid status")
    allowed = STATUS_TRANSITIONS.get(doc.status, set())
    if new_status not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot transition from {doc.status} to {new_status}",
        )
    action = new_status
    if new_status == DocumentStatus.pending_approval.value:
        action = "submitted"
    elif new_status == DocumentStatus.approved.value:
        action = "approved"
    elif new_status == DocumentStatus.draft.value and doc.status == DocumentStatus.pending_approval.value:
        action = "rejected"
    elif new_status == DocumentStatus.archived.value:
        action = "archived"

    doc.status = new_status
    db.add(
        ErpDocumentApproval(
            document_id=doc.id,
            action=action,
            acted_by=user.id,
            note=note,
        )
    )
    db.commit()
    db.refresh(doc)
    return _serialize_document(db, doc)


def soft_delete_document(db: Session, user: User, document_id: int) -> None:
    if not user_can_delete_documents(user):
        raise HTTPException(status_code=403, detail="Not permitted to delete documents")
    doc = get_document(db, user, document_id)
    doc.is_deleted = True
    db.commit()
