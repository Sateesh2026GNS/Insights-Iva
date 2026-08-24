import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import InvalidRequestError, OperationalError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import UnmappedInstanceError

from app.models.erp_notification import ErpNotification
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class NotificationRepository(BaseRepository):
    def __init__(self, db: Session, tenant_id: int, user_id: int):
        super().__init__(db, tenant_id)
        self.user_id = user_id

    def _base_query(self):
        return select(ErpNotification).where(
            ErpNotification.tenant_id == self.tenant_id,
            ErpNotification.user_id == self.user_id,
        )

    def list_paginated(self, page: int = 1, page_size: int = 20) -> tuple[list[ErpNotification], int]:
        page = max(1, page)
        page_size = min(max(1, page_size), 100)
        offset = (page - 1) * page_size

        try:
            total = self.db.scalar(
                select(func.count()).select_from(self._base_query().subquery())
            ) or 0

            rows = self.db.scalars(
                self._base_query()
                .order_by(
                    ErpNotification.is_read.asc(),
                    ErpNotification.created_at.desc(),
                    ErpNotification.id.desc(),
                )
                .offset(offset)
                .limit(page_size)
            ).all()

            return list(rows), int(total)
        except (OperationalError, SQLAlchemyError) as exc:
            logger.exception("Database error listing paginated notifications: %s", exc)
            raise HTTPException(503, "Database connection unavailable") from exc
        except Exception as exc:
            logger.exception("Error listing paginated notifications: %s", exc)
            raise HTTPException(500, "Database operation failed") from exc

    def count_unread(self) -> int:
        try:
            return int(
                self.db.scalar(
                    select(func.count()).where(
                        ErpNotification.tenant_id == self.tenant_id,
                        ErpNotification.user_id == self.user_id,
                        ErpNotification.is_read.is_(False),
                    )
                )
                or 0
            )
        except (OperationalError, SQLAlchemyError) as exc:
            logger.exception("Database error counting unread notifications: %s", exc)
            raise HTTPException(503, "Database connection unavailable") from exc
        except Exception as exc:
            logger.exception("Error counting unread notifications: %s", exc)
            raise HTTPException(500, "Database operation failed") from exc

    def get_by_id(self, notification_id: int) -> ErpNotification | None:
        try:
            return self.db.scalar(
                self._base_query().where(ErpNotification.id == notification_id)
            )
        except (OperationalError, SQLAlchemyError) as exc:
            logger.exception("Database error getting notification by id %s: %s", notification_id, exc)
            raise HTTPException(503, "Database connection unavailable") from exc
        except Exception as exc:
            logger.exception("Error getting notification by id %s: %s", notification_id, exc)
            raise HTTPException(500, "Database operation failed") from exc

    def mark_read(self, notification_id: int) -> ErpNotification | None:
        row = self.get_by_id(notification_id)
        if not row or row.is_read:
            return row
        row.is_read = True
        try:
            self.db.commit()
            self.db.refresh(row)
            return row
        except (OperationalError, SQLAlchemyError) as exc:
            self.db.rollback()
            logger.exception("Database error marking notification read: %s", exc)
            raise HTTPException(503, "Database commit failed. Transaction has been rolled back.") from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error marking notification read: %s", exc)
            raise HTTPException(500, "Database commit failed. Transaction has been rolled back.") from exc

    def mark_all_read(self) -> int:
        try:
            rows = self.db.scalars(
                self._base_query().where(ErpNotification.is_read.is_(False))
            ).all()
            count = 0
            for row in rows:
                row.is_read = True
                count += 1
            if count:
                self.db.commit()
            return count
        except (OperationalError, SQLAlchemyError) as exc:
            self.db.rollback()
            logger.exception("Database error marking all notifications read: %s", exc)
            raise HTTPException(503, "Database commit failed. Transaction has been rolled back.") from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error marking all notifications read: %s", exc)
            raise HTTPException(500, "Database commit failed. Transaction has been rolled back.") from exc

    def delete(self, notification_id: int) -> bool:
        row = self.get_by_id(notification_id)
        if not row:
            return False
        try:
            self.db.delete(row)
            self.db.commit()
            return True
        except (OperationalError, SQLAlchemyError) as exc:
            self.db.rollback()
            logger.exception("Database error deleting notification: %s", exc)
            raise HTTPException(503, "Database commit failed. Transaction has been rolled back.") from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error deleting notification: %s", exc)
            raise HTTPException(500, "Database commit failed. Transaction has been rolled back.") from exc

    def clear_all(self) -> int:
        try:
            rows = self.db.scalars(self._base_query()).all()
            count = len(rows)
            for row in rows:
                self.db.delete(row)
            if count:
                self.db.commit()
            return count
        except (OperationalError, SQLAlchemyError) as exc:
            self.db.rollback()
            logger.exception("Database error clearing all notifications: %s", exc)
            raise HTTPException(503, "Database commit failed. Transaction has been rolled back.") from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error clearing all notifications: %s", exc)
            raise HTTPException(500, "Database commit failed. Transaction has been rolled back.") from exc

    def create(self, *, commit: bool = True, **kwargs) -> ErpNotification:
        if "created_at" not in kwargs:
            kwargs["created_at"] = datetime.now(timezone.utc)
        row = ErpNotification(
            tenant_id=self.tenant_id,
            user_id=self.user_id,
            **kwargs,
        )
        try:
            self.db.add(row)
            if commit:
                self.db.commit()
                self.db.refresh(row)
            else:
                self.db.flush()
            return row
        except (OperationalError, SQLAlchemyError) as exc:
            if commit:
                self.db.rollback()
            logger.exception("Database error creating notification: %s", exc)
            raise HTTPException(503, "Database commit failed. Transaction has been rolled back.") from exc
        except Exception as exc:
            if commit:
                self.db.rollback()
            logger.exception("Unexpected error creating notification: %s", exc)
            raise HTTPException(500, "Database commit failed. Transaction has been rolled back.") from exc

    def refresh(self, obj: ErpNotification) -> ErpNotification:
        try:
            self.db.refresh(obj)
            return obj
        except (InvalidRequestError, UnmappedInstanceError) as exc:
            logger.exception("Invalid or detached object refresh: %s", exc)
            raise HTTPException(400, "invalid or detached object") from exc
        except (OperationalError, SQLAlchemyError) as exc:
            logger.exception("Database connection error on refresh: %s", exc)
            raise HTTPException(503, "Database connection unavailable") from exc
        except Exception as exc:
            logger.exception("Unexpected error on refresh: %s", exc)
            raise HTTPException(500, "Failed to refresh object.") from exc

    def count_for_user(self) -> int:
        try:
            return int(
                self.db.scalar(
                    select(func.count()).where(
                        ErpNotification.tenant_id == self.tenant_id,
                        ErpNotification.user_id == self.user_id,
                    )
                )
                or 0
            )
        except (OperationalError, SQLAlchemyError) as exc:
            logger.exception("Database error counting user notifications: %s", exc)
            raise HTTPException(503, "Database connection unavailable") from exc
        except Exception as exc:
            logger.exception("Error counting user notifications: %s", exc)
            raise HTTPException(500, "Database operation failed") from exc
