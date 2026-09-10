"""Base repository with tenant-scoped session and error handling."""

import logging

from fastapi import HTTPException, status
from sqlalchemy.exc import InvalidRequestError, SQLAlchemyError
from sqlalchemy.orm import Session
from sqlalchemy.orm.exc import UnmappedInstanceError

logger = logging.getLogger(__name__)


class BaseRepository:
    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id

    def save(self, entity, *, commit: bool = True):
        try:
            self.db.add(entity)
            if commit:
                self.db.commit()
                self.db.refresh(entity)
            else:
                self.db.flush()
            return entity
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.exception("Database error saving entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error saving record. Transaction has been rolled back.",
            ) from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error saving entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save record. Transaction has been rolled back.",
            ) from exc

    def refresh(self, entity):
        try:
            self.db.refresh(entity)
            return entity
        except HTTPException:
            raise
        except (InvalidRequestError, UnmappedInstanceError, SQLAlchemyError) as exc:
            logger.exception("Failed to refresh entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to refresh invalid or detached object",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error refreshing entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to refresh invalid or detached object",
            ) from exc
