import logging
from datetime import date

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import require_permission
from app.models.user import User
from app.schemas.erp_documents import (
    DocumentDuplicateCheck,
    DocumentDuplicateResponse,
    DocumentListResponse,
    DocumentStatusUpdate,
    DocumentSummaryResponse,
)
from app.services.documents.registry_service import (
    add_document_version,
    create_document_with_file,
    document_summary,
    find_duplicate,
    get_document,
    get_version_for_download,
    list_documents,
    list_versions,
    soft_delete_document,
    transition_status,
)
from app.services.documents.storage import (
    media_type_for,
    register_preview_token,
    resolve_file_path,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/document-library", tags=["document-library"])
MODULE = "documents"


@router.get("", response_model=DocumentListResponse)
def list_documents_endpoint(
    category: str | None = None,
    department_id: int | None = None,
    uploaded_by: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    file_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sort_dir: str = Query("desc"),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return list_documents(
        db,
        user,
        category=category,
        department_id=department_id,
        uploaded_by=uploaded_by,
        date_from=date_from,
        date_to=date_to,
        file_type=file_type,
        status=status,
        search=search,
        page=page,
        page_size=page_size,
        sort_dir=sort_dir,
    )


@router.get("/summary", response_model=DocumentSummaryResponse)
def summary_endpoint(
    category: str | None = None,
    department_id: int | None = None,
    uploaded_by: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    file_type: str | None = None,
    status: str | None = None,
    search: str | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    filters = {
        "category": category,
        "department_id": department_id,
        "uploaded_by": uploaded_by,
        "date_from": date_from,
        "date_to": date_to,
        "file_type": file_type,
        "status": status,
        "search": search,
    }
    return document_summary(db, user, filters)


@router.post("/check-duplicate", response_model=DocumentDuplicateResponse)
def check_duplicate_endpoint(
    body: DocumentDuplicateCheck,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    existing = find_duplicate(db, user.tenant_id, body.name, body.category, body.department_id)
    return DocumentDuplicateResponse(exists=bool(existing), document_id=existing.id if existing else None)


@router.post("")
async def create_document_endpoint(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form(...),
    department_id: int = Form(...),
    upload_note: str | None = Form(None),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = await file.read()
    return create_document_with_file(
        db,
        user,
        name=name,
        category=category,
        department_id=department_id,
        file_bytes=data,
        filename=file.filename or "upload",
        upload_note=upload_note,
    )


@router.post("/{document_id}/versions")
async def upload_version_endpoint(
    document_id: int,
    file: UploadFile = File(...),
    upload_note: str | None = Form(None),
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    data = await file.read()
    return add_document_version(
        db,
        user,
        document_id,
        file_bytes=data,
        filename=file.filename or "upload",
        upload_note=upload_note,
    )


@router.get("/{document_id}/versions")
def version_history_endpoint(
    document_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return list_versions(db, user, document_id)


@router.get("/{document_id}/preview")
def preview_endpoint(
    document_id: int,
    version: int | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    ver = get_version_for_download(db, user, document_id, version)
    path = resolve_file_path(ver.file_path)
    if ver.file_type not in ("pdf", "image"):
        raise HTTPException(status_code=400, detail="Preview not available for this file type")
    token = register_preview_token(path, ver.file_type, True, user.id, user.tenant_id)
    return {"url": f"/api/document-library/preview-file/{token}", "expires_in": 300}


@router.get("/preview-file/{token}")
def preview_file_endpoint(
    token: str,
    user: User = Depends(get_current_user),
):
    from app.services.documents.storage import consume_preview_token

    path, file_type, _inline = consume_preview_token(token, user.id, user.tenant_id)
    return FileResponse(
        path,
        media_type=media_type_for(file_type, path),
        content_disposition_type="inline",
        filename=path.name,
    )


@router.get("/{document_id}/download")
def download_endpoint(
    document_id: int,
    version: int | None = None,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    ver = get_version_for_download(db, user, document_id, version)
    path = resolve_file_path(ver.file_path)
    return FileResponse(
        path,
        media_type=media_type_for(ver.file_type, path),
        content_disposition_type="attachment",
        filename=ver.original_filename,
    )


@router.patch("/{document_id}/status")
def status_endpoint(
    document_id: int,
    body: DocumentStatusUpdate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return transition_status(db, user, document_id, body.status, body.note)


@router.delete("/{document_id}", status_code=204)
def delete_endpoint(
    document_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    soft_delete_document(db, user, document_id)
