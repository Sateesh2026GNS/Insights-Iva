"""Product data access."""

import logging

from fastapi import HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.exc import SQLAlchemyError

from app.models.product import Product
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class ProductRepository(BaseRepository):
    def list_all(self) -> list[Product]:
        try:
            return list(
                self.db.scalars(
                    select(Product)
                    .where(Product.tenant_id == self.tenant_id)
                    .order_by(Product.id.desc())
                ).all()
            )
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Database error during list_all: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error during list_all: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database operation failed",
            ) from exc

    def get_by_id(self, product_id: int) -> Product | None:
        if not isinstance(product_id, int) or isinstance(product_id, bool) or product_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid product ID",
            )
        try:
            return self.db.scalars(
                select(Product).where(
                    Product.id == product_id,
                    Product.tenant_id == self.tenant_id,
                )
            ).first()
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Database error during get_by_id: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error during get_by_id: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database operation failed",
            ) from exc

    def search(self, query: str, limit: int = 50) -> list[Product]:
        if not isinstance(query, str) or not query.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Search query must be a non-empty string",
            )
        if not isinstance(limit, int) or isinstance(limit, bool) or limit <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Limit must be a positive integer",
            )
        try:
            pattern = f"%{query.strip()}%"
            return list(
                self.db.scalars(
                    select(Product)
                    .where(
                        Product.tenant_id == self.tenant_id,
                        or_(
                            Product.name.ilike(pattern),
                            Product.sku.ilike(pattern),
                            Product.description.ilike(pattern),
                        ),
                    )
                    .limit(limit)
                ).all()
            )
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Database error during search: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error during search: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database operation failed",
            ) from exc
