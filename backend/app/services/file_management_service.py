"""Central file management service — presigned uploads, multipart, scan, download."""

from __future__ import annotations

import json
import logging
import math
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models.file_storage import FileAttachment, FileUploadChunk, FileUploadSession, StoredFile
from app.models.user import User
from app.services.audit_log_service import AuditLogService
from app.services.antivirus.scanner import get_antivirus_scanner
from app.services.file_entity_resolver import validate_entity_access
from app.services.file_rate_limiter import (
    check_concurrent_upload_limit,
    check_upload_rate_limits,
    release_concurrent_upload,
)
from app.services.file_validation import validate_file_metadata
from app.services.storage.factory import get_storage_provider

logger = logging.getLogger(__name__)

MULTIPART_THRESHOLD = 10 * 1024 * 1024  # 10 MB


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _file_to_dict(f: StoredFile) -> dict:
    return {
        "id": f.id,
        "tenant_id": f.tenant_id,
        "original_filename": f.original_filename,
        "mime_type": f.mime_type,
        "detected_mime_type": f.detected_mime_type,
        "file_extension": f.file_extension,
        "file_size": f.file_size,
        "checksum_sha256": f.checksum_sha256,
        "upload_status": f.upload_status,
        "scan_status": f.scan_status,
        "processing_status": f.processing_status,
        "storage_provider": f.storage_provider,
        "created_at": f.created_at,
        "updated_at": f.updated_at,
        "is_downloadable": f.scan_status == "SAFE" and f.processing_status == "READY" and not f.deleted_at,
    }


def _get_file(db: Session, tenant_id: int, file_id: int) -> StoredFile:
    f = db.get(StoredFile, file_id)
    if not f or f.tenant_id != tenant_id or f.deleted_at:
        raise HTTPException(404, "File not found")
    return f


def initiate_upload(
    db: Session,
    user: User,
    *,
    filename: str,
    mime_type: str | None,
    file_size: int,
    entity_type: str | None = None,
    entity_id: int | None = None,
    idempotency_key: str | None = None,
    request=None,
) -> dict:
    settings = get_settings()
    tenant_id = user.tenant_id
    if not tenant_id:
        raise HTTPException(400, "Tenant context required")

    if entity_type and entity_id:
        if not validate_entity_access(db, tenant_id, entity_type, entity_id):
            raise HTTPException(404, "Referenced entity not found for this company.")

    if idempotency_key:
        existing = db.scalar(
            select(StoredFile).where(
                StoredFile.tenant_id == tenant_id,
                StoredFile.idempotency_key == idempotency_key,
                StoredFile.deleted_at.is_(None),
            )
        )
        if existing:
            return {"file": _file_to_dict(existing), "reused": True}

    max_size = settings.max_file_size_bytes
    validation = validate_file_metadata(filename, mime_type, file_size, max_size)
    if not validation.ok:
        raise HTTPException(415, validation.message or "Unsupported file type")

    check_upload_rate_limits(tenant_id, user.id, file_size)
    check_concurrent_upload_limit(tenant_id, user.id)

    provider = get_storage_provider()
    stored = StoredFile(
        tenant_id=tenant_id,
        uploaded_by_user_id=user.id,
        original_filename=filename,
        storage_provider=provider.provider_name,
        storage_bucket=getattr(provider, "bucket", settings.s3_bucket or "local"),
        storage_key="pending",
        mime_type=validation.declared_mime,
        detected_mime_type=validation.detected_mime,
        file_extension=validation.extension,
        file_size=file_size,
        upload_status="PENDING_UPLOAD",
        scan_status="PENDING_SCAN",
        processing_status="PENDING",
        idempotency_key=idempotency_key,
    )
    db.add(stored)
    db.flush()

    storage_key = provider.build_storage_key(
        tenant_id, stored.id, entity_type, entity_id, filename
    )
    stored.storage_key = storage_key

    expires = settings.signed_url_upload_expiry_seconds
    use_multipart = file_size >= MULTIPART_THRESHOLD

    if use_multipart:
        mp = provider.initiate_multipart_upload(storage_key, validation.declared_mime or "application/octet-stream")
        chunk_size = settings.upload_chunk_size_bytes
        total_chunks = max(1, math.ceil(file_size / chunk_size))
        session = FileUploadSession(
            session_uuid=str(uuid.uuid4()),
            tenant_id=tenant_id,
            user_id=user.id,
            file_id=stored.id,
            storage_upload_id=mp.upload_id,
            total_chunks=total_chunks,
            completed_chunks=0,
            chunk_size_bytes=chunk_size,
            total_size_bytes=file_size,
            status="ACTIVE",
            idempotency_key=idempotency_key,
            expires_at=_utcnow() + timedelta(seconds=settings.upload_session_expiry_seconds),
        )
        db.add(session)
        db.flush()
        parts = []
        for part_num in range(1, total_chunks + 1):
            presigned = provider.generate_presigned_upload_part(
                storage_key, mp.upload_id, part_num, expires
            )
            parts.append({
                "part_number": part_num,
                "upload_url": presigned.upload_url,
                "method": presigned.method,
                "headers": presigned.headers or {},
            })
        db.commit()
        AuditLogService.log(
            db=db,
            current_user=user,
            action="file_upload_initiated",
            resource="files",
            resource_id=stored.id,
            module_name="documents",
            details=json.dumps({"file_id": stored.id, "multipart": True}),
            request=request,
        )
        return {
            "file": _file_to_dict(stored),
            "multipart": True,
            "upload_session_id": session.session_uuid,
            "storage_upload_id": mp.upload_id,
            "chunk_size_bytes": chunk_size,
            "total_chunks": total_chunks,
            "parts": parts,
            "expires_in_seconds": expires,
        }

    presigned = provider.generate_presigned_upload(
        storage_key,
        validation.declared_mime or "application/octet-stream",
        file_size,
        expires,
    )
    db.commit()
    AuditLogService.log(
        db=db,
        current_user=user,
        action="file_upload_initiated",
        resource="files",
        resource_id=stored.id,
        module_name="documents",
        details=json.dumps({"file_id": stored.id, "multipart": False}),
        request=request,
    )
    return {
        "file": _file_to_dict(stored),
        "multipart": False,
        "upload_url": presigned.upload_url,
        "method": presigned.method,
        "headers": presigned.headers or {},
        "expires_in_seconds": presigned.expires_in_seconds,
    }


def complete_upload(
    db: Session,
    user: User,
    file_id: int,
    *,
    checksum_sha256: str | None = None,
    upload_session_id: str | None = None,
    background_tasks: BackgroundTasks | None = None,
    request=None,
) -> dict:
    tenant_id = user.tenant_id
    stored = _get_file(db, tenant_id, file_id)
    if stored.upload_status not in ("PENDING_UPLOAD", "UPLOADING"):
        raise HTTPException(409, "Upload already completed or not in a valid state.")

    provider = get_storage_provider()

    if upload_session_id:
        session = db.scalar(
            select(FileUploadSession).where(
                FileUploadSession.session_uuid == upload_session_id,
                FileUploadSession.tenant_id == tenant_id,
                FileUploadSession.file_id == file_id,
            )
        )
        if not session:
            raise HTTPException(404, "Upload session not found")
        if session.status != "ACTIVE":
            raise HTTPException(409, "Upload session is no longer active")
        if _as_utc(session.expires_at) < _utcnow():
            raise HTTPException(410, "Upload session has expired")

        chunks = db.scalars(
            select(FileUploadChunk).where(FileUploadChunk.session_id == session.id)
        ).all()
        if len(chunks) < session.total_chunks:
            raise HTTPException(
                400,
                f"Upload incomplete: {len(chunks)}/{session.total_chunks} chunks received.",
            )
        parts = [
            {"PartNumber": c.part_number, "ETag": c.etag or f'"part{c.part_number}"'}
            for c in sorted(chunks, key=lambda x: x.part_number)
        ]
        provider.complete_multipart_upload(
            stored.storage_key, session.storage_upload_id or "", parts
        )
        session.status = "COMPLETED"
        session.completed_chunks = session.total_chunks

    head = provider.head_object(stored.storage_key)
    if not head:
        raise HTTPException(400, "File was not found in storage. Upload may have failed.")

    actual_size = int(head.get("ContentLength") or stored.file_size)
    settings = get_settings()
    if actual_size > settings.max_file_size_bytes:
        raise HTTPException(413, "Uploaded file exceeds maximum allowed size.")

    content_header = provider.read_object_header(stored.storage_key)
    validation = validate_file_metadata(
        stored.original_filename,
        stored.mime_type,
        actual_size,
        settings.max_file_size_bytes,
        content_header,
    )
    if not validation.ok:
        stored.upload_status = "REJECTED"
        stored.scan_status = "REJECTED"
        stored.processing_status = "FAILED"
        stored.scan_message = validation.message
        db.commit()
        raise HTTPException(415, validation.message or "Unsupported file type")

    stored.detected_mime_type = validation.detected_mime
    stored.file_size = actual_size
    stored.upload_status = "UPLOADED"
    if checksum_sha256:
        stored.checksum_sha256 = checksum_sha256

    release_concurrent_upload(tenant_id, user.id)
    db.flush()
    db.commit()

    AuditLogService.log(
        db=db,
        current_user=user,
        action="file_upload_completed",
        resource="files",
        resource_id=stored.id,
        module_name="documents",
        details=json.dumps({"file_id": stored.id}),
        request=request,
    )

    if background_tasks:
        background_tasks.add_task(_run_scan_and_process, stored.id, tenant_id)
    else:
        _run_scan_and_process(stored.id, tenant_id)

    db.refresh(stored)
    return {"file": _file_to_dict(stored)}


def register_upload_part(
    db: Session,
    user: User,
    upload_session_id: str,
    part_number: int,
    etag: str,
    size_bytes: int,
) -> dict:
    session = db.scalar(
        select(FileUploadSession).where(
            FileUploadSession.session_uuid == upload_session_id,
            FileUploadSession.tenant_id == user.tenant_id,
            FileUploadSession.user_id == user.id,
        )
    )
    if not session or session.status != "ACTIVE":
        raise HTTPException(404, "Upload session not found")
    if _as_utc(session.expires_at) < _utcnow():
        raise HTTPException(410, "Upload session has expired")

    existing = db.scalar(
        select(FileUploadChunk).where(
            FileUploadChunk.session_id == session.id,
            FileUploadChunk.part_number == part_number,
        )
    )
    if existing:
        existing.etag = etag
        existing.size_bytes = size_bytes
        existing.completed_at = _utcnow()
    else:
        db.add(
            FileUploadChunk(
                session_id=session.id,
                part_number=part_number,
                etag=etag,
                size_bytes=size_bytes,
                completed_at=_utcnow(),
            )
        )
        session.completed_chunks = min(
            session.total_chunks,
            (session.completed_chunks or 0) + 1,
        )
    stored = _get_file(db, user.tenant_id, session.file_id)
    stored.upload_status = "UPLOADING"
    db.commit()
    return {
        "upload_session_id": upload_session_id,
        "part_number": part_number,
        "completed_chunks": session.completed_chunks,
        "total_chunks": session.total_chunks,
    }


def get_download_url(db: Session, user: User, file_id: int) -> dict:
    stored = _get_file(db, user.tenant_id, file_id)
    if stored.scan_status != "SAFE":
        if stored.scan_status in ("QUARANTINED", "REJECTED"):
            raise HTTPException(403, "This file has been quarantined and cannot be downloaded.")
        raise HTTPException(409, "File is not ready for download. Security scan is still in progress.")
    if stored.processing_status != "READY":
        raise HTTPException(409, "File is still being processed.")
    if stored.upload_status != "UPLOADED":
        raise HTTPException(409, "File upload is not complete.")

    settings = get_settings()
    provider = get_storage_provider()
    signed = provider.generate_presigned_download(
        stored.storage_key,
        stored.original_filename,
        settings.signed_url_download_expiry_seconds,
    )
    AuditLogService.log(
        db=db,
        current_user=user,
        action="file_download_url_issued",
        resource="files",
        resource_id=stored.id,
        module_name="documents",
        details=json.dumps({"file_id": stored.id}),
    )
    return {
        "download_url": signed.download_url,
        "expires_in_seconds": signed.expires_in_seconds,
        "filename": stored.original_filename,
    }


def attach_file(
    db: Session,
    user: User,
    file_id: int,
    entity_type: str,
    entity_id: int,
    label: str | None = None,
) -> dict:
    stored = _get_file(db, user.tenant_id, file_id)
    if not validate_entity_access(db, user.tenant_id, entity_type, entity_id):
        raise HTTPException(404, "Referenced entity not found for this company.")
    att = FileAttachment(
        tenant_id=user.tenant_id,
        file_id=stored.id,
        entity_type=entity_type.lower(),
        entity_id=entity_id,
        label=label,
        created_by_user_id=user.id,
    )
    db.add(att)
    db.commit()
    return {"attachment_id": att.id, "file_id": stored.id, "entity_type": entity_type, "entity_id": entity_id}


def soft_delete_file(db: Session, user: User, file_id: int, request=None) -> dict:
    stored = _get_file(db, user.tenant_id, file_id)
    stored.deleted_at = _utcnow()
    db.commit()
    AuditLogService.log(
        db=db,
        current_user=user,
        action="file_deleted",
        resource="files",
        resource_id=stored.id,
        module_name="documents",
        details=json.dumps({"file_id": stored.id}),
        request=request,
    )
    return {"deleted": True, "id": file_id}


def get_file_status(db: Session, user: User, file_id: int) -> dict:
    stored = _get_file(db, user.tenant_id, file_id)
    return _file_to_dict(stored)


def resume_upload_session(db: Session, user: User, upload_session_id: str) -> dict:
    session = db.scalar(
        select(FileUploadSession).where(
            FileUploadSession.session_uuid == upload_session_id,
            FileUploadSession.tenant_id == user.tenant_id,
            FileUploadSession.user_id == user.id,
        )
    )
    if not session or session.status != "ACTIVE":
        raise HTTPException(404, "Upload session not found")
    if _as_utc(session.expires_at) < _utcnow():
        raise HTTPException(410, "Upload session has expired")

    stored = _get_file(db, user.tenant_id, session.file_id)
    provider = get_storage_provider()
    settings = get_settings()
    expires = settings.signed_url_upload_expiry_seconds

    completed = db.scalars(
        select(FileUploadChunk.part_number).where(FileUploadChunk.session_id == session.id)
    ).all()
    completed_set = set(completed)

    pending_parts = []
    for part_num in range(1, session.total_chunks + 1):
        if part_num in completed_set:
            continue
        presigned = provider.generate_presigned_upload_part(
            stored.storage_key,
            session.storage_upload_id or "",
            part_num,
            expires,
        )
        pending_parts.append({
            "part_number": part_num,
            "upload_url": presigned.upload_url,
            "method": presigned.method,
            "headers": presigned.headers or {},
        })

    return {
        "upload_session_id": session.session_uuid,
        "file_id": session.file_id,
        "total_chunks": session.total_chunks,
        "completed_chunks": len(completed_set),
        "completed_part_numbers": sorted(completed_set),
        "pending_parts": pending_parts,
        "expires_in_seconds": expires,
        "status": session.status,
    }


def cleanup_expired_upload_sessions(db: Session) -> int:
    """Mark expired sessions and orphaned pending uploads for reconciliation."""
    now = _utcnow()
    sessions = db.scalars(
        select(FileUploadSession).where(
            FileUploadSession.status == "ACTIVE",
            FileUploadSession.expires_at < _as_utc(now),
        )
    ).all()
    count = 0
    for session in sessions:
        session.status = "EXPIRED"
        stored = db.get(StoredFile, session.file_id)
        if stored and stored.upload_status == "PENDING_UPLOAD":
            stored.upload_status = "FAILED"
            stored.processing_status = "FAILED"
            stored.processing_message = "Upload session expired"
        count += 1
    if count:
        db.commit()
    return count


def _run_scan_and_process(file_id: int, tenant_id: int) -> None:
    from app.core.database import SessionLocal

    db = SessionLocal()
    try:
        stored = db.get(StoredFile, file_id)
        if not stored or stored.tenant_id != tenant_id:
            return
        stored.scan_status = "SCANNING"
        db.commit()

        scanner = get_antivirus_scanner()
        result = scanner.scan_object(stored.storage_key, stored.storage_provider)

        stored.scan_status = result.status
        stored.scan_message = result.message
        db.commit()

        AuditLogService.log(
            db=db,
            action="file_scan_completed",
            resource="files",
            resource_id=file_id,
            module_name="documents",
            details=json.dumps(
                {"file_id": file_id, "status": result.status, "scanner": result.scanner_name}
            ),
        )

        if result.status == "SAFE":
            stored.processing_status = "PROCESSING"
            db.commit()
            # Placeholder for thumbnails/metadata — mark ready when done
            stored.processing_status = "READY"
            stored.processing_message = None
            db.commit()
        elif result.status == "PENDING_SCAN":
            stored.processing_status = "PENDING"
            db.commit()
        else:
            stored.processing_status = "FAILED"
            stored.processing_message = result.message
            db.commit()
    except Exception:
        logger.exception("file scan/process failed file_id=%s", file_id)
        try:
            stored = db.get(StoredFile, file_id)
            if stored:
                stored.scan_status = "FAILED"
                stored.processing_status = "FAILED"
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
