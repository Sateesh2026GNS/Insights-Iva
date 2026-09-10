"""Data access for authentication and password-reset tokens."""

import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import InvalidRequestError, SQLAlchemyError
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.orm.exc import UnmappedInstanceError

from app.models.security import PasswordResetToken
from app.models.user import User
from app.utils.token import generate_token, hash_token

logger = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> User | None:
        try:
            return self.db.scalars(
                select(User)
                .where(User.email == email.lower().strip())
                .options(selectinload(User.tenant))
            ).first()
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Database error getting user by email: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc

    def get_user_by_id(self, user_id: int, tenant_id: int | None = None) -> User | None:
        try:
            stmt = select(User).where(User.id == user_id)
            if tenant_id is not None:
                stmt = stmt.where(User.tenant_id == tenant_id)
            return self.db.scalars(stmt).first()
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Database error getting user by id: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error getting user by id: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database operation failed.",
            ) from exc

    def invalidate_active_reset_tokens(self, user_id: int) -> None:
        try:
            self.db.execute(
                update(PasswordResetToken)
                .where(
                    PasswordResetToken.user_id == user_id,
                    PasswordResetToken.used.is_(False),
                )
                .values(used=True)
            )
        except Exception as exc:
            logger.exception("Error invalidating reset tokens: %s", exc)

    def create_password_reset_token(
        self, user_id: int, *, expires_at: datetime
    ) -> str:
        """Create a one-time reset token. Returns raw token for email link."""
        try:
            self.invalidate_active_reset_tokens(user_id)
            raw = generate_token()
            self.db.add(
                PasswordResetToken(
                    user_id=user_id,
                    token_hash=hash_token(raw),
                    expires_at=expires_at,
                    used=False,
                )
            )
            self.db.flush()
            return raw
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.exception("Database error creating password reset token: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error creating reset token. Transaction has been rolled back.",
            ) from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error creating password reset token: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create reset token. Transaction has been rolled back.",
            ) from exc

    def get_reset_token_row(self, raw_token: str, for_update: bool = False) -> PasswordResetToken | None:
        token_hash = hash_token(raw_token)
        stmt = select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
        if for_update:
            stmt = stmt.with_for_update()
        return self.db.scalars(stmt).first()

    def mark_reset_token_used(self, row: PasswordResetToken) -> None:
        row.used = True
        self.db.flush()

    def delete_reset_token(self, row: PasswordResetToken) -> None:
        """Permanently remove a reset token so it cannot be reused."""
        self.db.delete(row)
        self.db.flush()

    def update_user_password(self, user: User, hashed_password: str) -> None:
        try:
            user.hashed_password = hashed_password
            user.failed_login_attempts = 0
            user.locked_until = None
            self.db.flush()
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.exception("Database error updating user password: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error updating password. Transaction has been rolled back.",
            ) from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Unexpected error updating user password: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update password. Transaction has been rolled back.",
            ) from exc

    def commit(self) -> None:
        try:
            self.db.commit()
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            self.db.rollback()
            logger.exception("Database commit error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database error saving record. Transaction has been rolled back.",
            ) from exc
        except Exception as exc:
            self.db.rollback()
            logger.exception("Database commit error: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to save record. Transaction has been rolled back.",
            ) from exc

    def refresh(self, obj, attribute_names=None) -> None:
        try:
            if attribute_names:
                self.db.refresh(obj, attribute_names=attribute_names)
            else:
                self.db.refresh(obj)
        except HTTPException:
            raise
        except (InvalidRequestError, UnmappedInstanceError) as exc:
            logger.exception("Failed to refresh entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to refresh invalid or detached object",
            ) from exc
        except SQLAlchemyError as exc:
            logger.exception("Failed to refresh entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error refreshing entity: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to refresh object.",
            ) from exc
