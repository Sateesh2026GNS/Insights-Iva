"""Centralized file management API — presigned uploads, multipart, downloads."""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.config import get_settings
from app.core.permissions import require_permission
from app.models.user import User
from app.schemas.file_storage import (
    AttachFileRequest,
    AttachFileResponse,
    DeleteFileResponse,
    DownloadUrlResponse,
    StoredFileOut,
    UploadCompleteRequest,
    UploadPartRequest,
    UploadPartResponse,
    UploadSessionResumeResponse,
    UploadUrlRequest,
    UploadUrlResponse,
)
from app.services.file_management_service import (
    attach_file,
    complete_upload,
    get_download_url,
    get_file_status,
    initiate_upload,
    register_upload_part,
    resume_upload_session,
    soft_delete_file,
)
from app.services.storage.factory import get_storage_provider
from app.services.storage.local_provider import LocalStorageProvider
from app.services.storage.token_store import resolve_download_token, resolve_upload_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/files", tags=["files"])
MODULE = "documents"


def _stored_file_out(data: dict) -> StoredFileOut:
    return StoredFileOut(**data["file"] if "file" in data else data)


@router.post("/upload-url", response_model=UploadUrlResponse)
def create_upload_url(
    payload: UploadUrlRequest,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> UploadUrlResponse:
    if not user.tenant_id:
        raise HTTPException(400, "Tenant context required")
    try:
        result = initiate_upload(
            db,
            user,
            filename=payload.filename,
            mime_type=payload.mime_type,
            file_size=payload.file_size,
            entity_type=payload.entity_type,
            entity_id=payload.entity_id,
            idempotency_key=payload.idempotency_key,
            request=request,
        )
        return UploadUrlResponse(**result)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error creating upload URL tenant_id=%s", user.tenant_id)
        db.rollback()
        raise HTTPException(500, "Database error initiating upload") from exc


@router.post("/upload-complete/{file_id}", response_model=dict)
def upload_complete(
    file_id: int,
    payload: UploadCompleteRequest,
    background_tasks: BackgroundTasks,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> dict:
    try:
        return complete_upload(
            db,
            user,
            file_id,
            checksum_sha256=payload.checksum_sha256,
            upload_session_id=payload.upload_session_id,
            background_tasks=background_tasks,
            request=request,
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error completing upload file_id=%s", file_id)
        db.rollback()
        raise HTTPException(500, "Database error completing upload") from exc


@router.post("/upload-sessions/{session_id}/parts", response_model=UploadPartResponse)
def register_part(
    session_id: str,
    payload: UploadPartRequest,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> UploadPartResponse:
    result = register_upload_part(
        db,
        user,
        session_id,
        payload.part_number,
        payload.etag,
        payload.size_bytes,
    )
    return UploadPartResponse(**result)


@router.get("/upload-sessions/{session_id}/resume", response_model=UploadSessionResumeResponse)
def resume_session(
    session_id: str,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> UploadSessionResumeResponse:
    result = resume_upload_session(db, user, session_id)
    return UploadSessionResumeResponse(**result)


@router.get("/{file_id}", response_model=StoredFileOut)
def get_file(
    file_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> StoredFileOut:
    return StoredFileOut(**get_file_status(db, user, file_id))


@router.get("/{file_id}/status", response_model=StoredFileOut)
def get_file_status_endpoint(
    file_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> StoredFileOut:
    return StoredFileOut(**get_file_status(db, user, file_id))


@router.get("/{file_id}/download-url", response_model=DownloadUrlResponse)
def download_url(
    file_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> DownloadUrlResponse:
    result = get_download_url(db, user, file_id)
    return DownloadUrlResponse(**result)


@router.post("/{file_id}/attach", response_model=AttachFileResponse)
def attach_file_endpoint(
    file_id: int,
    payload: AttachFileRequest,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> AttachFileResponse:
    result = attach_file(
        db,
        user,
        file_id,
        payload.entity_type,
        payload.entity_id,
        payload.label,
    )
    return AttachFileResponse(**result)


@router.delete("/{file_id}", response_model=DeleteFileResponse)
def delete_file(
    file_id: int,
    request: Request,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> DeleteFileResponse:
    result = soft_delete_file(db, user, file_id, request=request)
    return DeleteFileResponse(**result)


# --- Local development storage handlers (not used with S3/GCS) ---


@router.put("/local-upload/{token}")
async def local_upload(token: str, request: Request):
    """Accept direct PUT uploads for local development storage."""
    settings = get_settings()
    if (settings.storage_provider or "local").lower() != "local":
        raise HTTPException(404, "Not found")
    storage_key = resolve_upload_token(token)
    if not storage_key:
        raise HTTPException(410, "Upload URL has expired")
    provider = get_storage_provider()
    if not isinstance(provider, LocalStorageProvider):
        raise HTTPException(404, "Not found")
    max_size = get_settings().max_file_size_bytes
    data = await request.body()
    if len(data) > max_size:
        raise HTTPException(413, "Uploaded file exceeds maximum allowed size.")
    provider.write_bytes(storage_key, data)
    return {"ok": True, "size": len(data)}


@router.put("/local-upload-part/{upload_id}/{part_number}")
async def local_upload_part(upload_id: str, part_number: int, request: Request):
    settings = get_settings()
    if (settings.storage_provider or "local").lower() != "local":
        raise HTTPException(404, "Not found")
    token = f"{upload_id}:{part_number}"
    storage_key = resolve_upload_token(token)
    if not storage_key:
        raise HTTPException(410, "Upload URL has expired")
    provider = get_storage_provider()
    if not isinstance(provider, LocalStorageProvider):
        raise HTTPException(404, "Not found")
    max_size = get_settings().upload_chunk_size_bytes
    data = await request.body()
    if len(data) > max_size:
        raise HTTPException(413, "Upload chunk exceeds maximum allowed size.")
    etag = provider.write_part(storage_key, upload_id, part_number, data)
    return {"etag": etag, "size": len(data)}


@router.get("/local-download/{token}")
def local_download(token: str):
    settings = get_settings()
    if (settings.storage_provider or "local").lower() != "local":
        raise HTTPException(404, "Not found")
    resolved = resolve_download_token(token)
    if not resolved:
        raise HTTPException(410, "Download URL has expired")
    provider = get_storage_provider()
    if not isinstance(provider, LocalStorageProvider):
        raise HTTPException(404, "Not found")
    path = provider._path_for_key(resolved.storage_key)
    if not path.exists():
        raise HTTPException(404, "File not found")
    return FileResponse(
        path,
        filename=resolved.filename or path.name,
        media_type="application/octet-stream",
    )
