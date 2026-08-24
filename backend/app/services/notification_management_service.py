"""Enterprise notification management service."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from datetime import datetime, timezone

from app.models.erp_notification import NOTIFICATION_PRIORITIES, NOTIFICATION_TYPES, ErpNotification
from app.models.user import User
from app.repositories.notification_repository import NotificationRepository


def _iso(dt: datetime | None) -> str | None:
    if dt is None:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat()


def _serialize(row: ErpNotification) -> dict:
    return {
        "id": row.id,
        "title": row.title,
        "message": row.message,
        "type": row.type,
        "priority": row.priority,
        "module": row.module,
        "action_url": row.action_url,
        "is_read": row.is_read,
        "read": row.is_read,
        "created_by": row.created_by,
        "created_at": _iso(row.created_at),
        "updated_at": _iso(row.updated_at),
    }


class NotificationManagementService:
    def __init__(self, db: Session, user: User):
        self.db = db
        self.user = user
        self.repo = NotificationRepository(db, user.tenant_id, user.id)

    def list_notifications(self, page: int = 1, page_size: int = 20) -> dict:
        rows, total = self.repo.list_paginated(page, page_size)
        total = max(0, total)
        unread = max(0, self.repo.count_unread())
        has_more = page * page_size < total
        return {
            "items": [_serialize(r) for r in rows],
            "notifications": [_serialize(r) for r in rows],
            "total": total,
            "page": page,
            "page_size": page_size,
            "has_more": has_more,
            "unread_count": unread,
            "count": unread,
        }

    def unread_count(self) -> dict:
        count = max(0, self.repo.count_unread())
        return {"unread_count": count, "count": count}

    def mark_read(self, notification_id: int) -> dict:
        row = self.repo.mark_read(notification_id)
        if not row:
            raise HTTPException(status_code=404, detail="Notification not found")
        return {
            "notification": _serialize(row),
            **self.unread_count(),
        }

    def mark_all_read(self) -> dict:
        updated = self.repo.mark_all_read()
        return {
            "updated": updated,
            "message": f"{updated} notification(s) marked as read",
            **self.unread_count(),
            **self.list_notifications(page=1, page_size=20),
        }

    def delete_notification(self, notification_id: int) -> dict:
        if not self.repo.delete(notification_id):
            raise HTTPException(status_code=404, detail="Notification not found")
        return {
            "deleted": True,
            **self.unread_count(),
            **self.list_notifications(page=1, page_size=20),
        }

    def clear_all(self) -> dict:
        deleted = self.repo.clear_all()
        return {
            "deleted": deleted,
            "unread_count": 0,
            "count": 0,
            "items": [],
            "notifications": [],
            "total": 0,
            "page": 1,
            "page_size": 20,
            "has_more": False,
        }

    @staticmethod
    def create_for_user(
        db: Session,
        *,
        tenant_id: int,
        user_id: int,
        title: str,
        message: str,
        type: str = "information",
        priority: str = "medium",
        module: str = "system",
        action_url: str | None = None,
        created_by: str | None = None,
        created_by_user_id: int | None = None,
        commit: bool = True,
    ) -> ErpNotification:
        ntype = type if type in NOTIFICATION_TYPES else "information"
        npriority = priority if priority in NOTIFICATION_PRIORITIES else "medium"
        repo = NotificationRepository(db, tenant_id, user_id)
        return repo.create(
            commit=commit,
            title=title,
            message=message,
            type=ntype,
            priority=npriority,
            module=module,
            action_url=action_url,
            created_by=created_by,
            created_by_user_id=created_by_user_id,
        )


# Backward-compatible helpers for dashboard / operator
def get_user_notifications(db: Session, user: User, page: int = 1, page_size: int = 20) -> dict:
    return NotificationManagementService(db, user).list_notifications(page, page_size)


def mark_notifications_read(db: Session, user: User, notification_ids: list | None = None) -> dict:
    svc = NotificationManagementService(db, user)
    if notification_ids:
        for nid in notification_ids:
            try:
                svc.mark_read(int(nid))
            except (ValueError, HTTPException):
                continue
        return svc.list_notifications()
    return svc.mark_all_read()


def clear_all_notifications(db: Session, user: User) -> dict:
    return NotificationManagementService(db, user).clear_all()
