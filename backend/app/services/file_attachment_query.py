"""Query file attachments linked to business entities."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.file_storage import FileAttachment, StoredFile


def list_entity_attachments(
    db: Session,
    tenant_id: int,
    entity_type: str,
    entity_id: int,
    *,
    limit: int = 50,
) -> list[dict]:
    et = (entity_type or "").lower().replace("-", "_")
    rows = db.execute(
        select(
            FileAttachment.id,
            StoredFile.id,
            StoredFile.original_filename,
            StoredFile.mime_type,
            StoredFile.file_size,
            StoredFile.upload_status,
            FileAttachment.label,
            FileAttachment.created_at,
        )
        .join(StoredFile, StoredFile.id == FileAttachment.file_id)
        .where(
            FileAttachment.tenant_id == tenant_id,
            FileAttachment.entity_type == et,
            FileAttachment.entity_id == entity_id,
            StoredFile.tenant_id == tenant_id,
            StoredFile.deleted_at.is_(None),
        )
        .order_by(FileAttachment.created_at.desc())
        .limit(limit)
    ).all()
    return [
        {
            "attachment_id": r[0],
            "id": r[1],
            "filename": r[2],
            "mime_type": r[3],
            "file_size": int(r[4] or 0),
            "upload_status": r[5],
            "label": r[6],
            "created_at": r[7].isoformat() if r[7] else None,
        }
        for r in rows
    ]
