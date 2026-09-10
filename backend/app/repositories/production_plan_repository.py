"""Production plan (production orders) data access."""

import logging
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.models.production import ProductionOrder
from app.repositories.base_repository import BaseRepository

logger = logging.getLogger(__name__)


class ProductionPlanRepository(BaseRepository):
    def list_all(self) -> list[ProductionOrder]:
        try:
            return list(
                self.db.scalars(
                    select(ProductionOrder)
                    .where(ProductionOrder.tenant_id == self.tenant_id)
                    .order_by(ProductionOrder.id.desc())
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

    def get_by_id(self, plan_id: int) -> ProductionOrder | None:
        if not isinstance(plan_id, int) or isinstance(plan_id, bool) or plan_id <= 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid plan ID",
            )
        try:
            return self.db.scalars(
                select(ProductionOrder).where(
                    ProductionOrder.id == plan_id,
                    ProductionOrder.tenant_id == self.tenant_id,
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

    def list_today(self) -> list[ProductionOrder]:
        try:
            today = date.today()
            orders = self.list_all()
            result = []
            for order in orders:
                if getattr(order, "start_date", None):
                    start = order.start_date
                    if isinstance(start, (datetime, date)):
                        try:
                            if isinstance(start, datetime) and start.tzinfo is None:
                                start = start.replace(tzinfo=timezone.utc)
                            d = start.date() if isinstance(start, datetime) else start
                            if d == today:
                                result.append(order)
                                continue
                        except Exception:
                            pass
                if getattr(order, "status", None) in ("in_progress", "running", "planned"):
                    result.append(order)
            return result[:20] if result else orders[:10]
        except HTTPException:
            raise
        except SQLAlchemyError as exc:
            logger.exception("Database error during list_today: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Database connection unavailable",
            ) from exc
        except Exception as exc:
            logger.exception("Unexpected error during list_today: %s", exc)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Database operation failed",
            ) from exc
