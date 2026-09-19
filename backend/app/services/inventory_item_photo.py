"""Primary item photo via centralized file attachments (entity_type=inventory_item)."""

from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.file_storage import FileAttachment, StoredFile
from app.models.inventory import InventoryItem
from app.models.user import User
from app.services.file_management_service import attach_file
from app.utils.tenant_validation import assert_inventory_item_owned

ENTITY_TYPE = "inventory_item"
PHOTO_LABEL = "item_photo"


def get_primary_photo_file_id(db: Session, tenant_id: int, item_id: int) -> int | None:
    row = db.scalars(
        select(FileAttachment)
        .join(StoredFile, StoredFile.id == FileAttachment.file_id)
        .where(
            FileAttachment.tenant_id == tenant_id,
            FileAttachment.entity_type == ENTITY_TYPE,
            FileAttachment.entity_id == item_id,
            FileAttachment.label == PHOTO_LABEL,
            StoredFile.deleted_at.is_(None),
            StoredFile.upload_status == "UPLOADED",
        )
        .order_by(FileAttachment.id.desc())
    ).first()
    return row.file_id if row else None


def attach_primary_photo(db: Session, user: User, item_id: int, file_id: int) -> None:
    assert_inventory_item_owned(db, user.tenant_id, item_id)
    stored = db.scalars(
        select(StoredFile).where(
            StoredFile.id == file_id,
            StoredFile.tenant_id == user.tenant_id,
            StoredFile.deleted_at.is_(None),
        )
    ).first()
    if not stored:
        from fastapi import HTTPException

        raise HTTPException(404, "File not found")
    attach_file(db, user, file_id, ENTITY_TYPE, item_id, label=PHOTO_LABEL)
