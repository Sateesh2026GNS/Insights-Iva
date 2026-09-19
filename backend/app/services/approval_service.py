import logging
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.hr import LeaveRequest
from app.models.inventory import StockAdjustment, Supplier
from app.models.procurement import MaterialRequest, PurchaseOrder
from app.models.production import ProductionOrder

logger = logging.getLogger(__name__)


def get_pending_approvals(db: Session, tenant_id: int) -> dict:
    try:
        leave_requests = db.scalar(
            select(func.count(LeaveRequest.id)).where(
                LeaveRequest.tenant_id == tenant_id,
                LeaveRequest.status == "pending",
            )
        ) or 0
        material_requests = db.scalar(
            select(func.count(MaterialRequest.id)).where(
                MaterialRequest.tenant_id == tenant_id,
                MaterialRequest.approval_status == "pending",
            )
        ) or 0
        stock_adjustments = db.scalar(
            select(func.count(StockAdjustment.id)).where(
                StockAdjustment.tenant_id == tenant_id,
                StockAdjustment.status == "pending",
            )
        ) or 0
        purchase_orders = db.scalar(
            select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.status == "draft",
            )
        ) or 0
        vendors = db.scalar(
            select(func.count(Supplier.id)).where(
                Supplier.tenant_id == tenant_id,
                Supplier.approval_status == "pending",
            )
        ) or 0
        production_orders = db.scalar(
            select(func.count(ProductionOrder.id)).where(
                ProductionOrder.tenant_id == tenant_id,
                ProductionOrder.status.in_(("planned", "pending")),
            )
        ) or 0
        return {
            "leave_requests": int(leave_requests),
            "material_requests": int(material_requests),
            "purchase_orders": int(purchase_orders),
            "vendors": int(vendors),
            "production_orders": int(production_orders),
            "inventory": int(stock_adjustments),
            "total": int(
                leave_requests
                + material_requests
                + purchase_orders
                + vendors
                + production_orders
                + stock_adjustments
            ),
        }
    except SQLAlchemyError as exc:
        logger.exception("get_pending_approvals database error for tenant %s: %s", tenant_id, exc)
        db.rollback()
        raise
    except Exception as exc:
        logger.exception("get_pending_approvals unexpected error for tenant %s: %s", tenant_id, exc)
        raise
