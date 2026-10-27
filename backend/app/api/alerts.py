import logging
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status as http_status
from pydantic import BaseModel, Field
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.api.auth_deps import get_current_user
from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope, user_is_admin
from app.models.user import User
from app.schemas.alert import AlertCreate, AlertListResponse, AlertRead
from app.schemas.operator import NotificationReadRequest
from app.services.alert_service import (
    acknowledge_alert,
    create_alert,
    delete_alert,
    get_alert,
    list_alerts,
    mark_alert_read,
    mark_all_alerts_read,
    resolve_alert,
    sync_low_stock_alerts,
)
from app.services.notification_management_service import NotificationManagementService
from app.services.order_delay_service import (
    acknowledge_order_delay,
    add_follow_up,
    get_order_delay,
    list_order_delays,
    notify_assigned_user,
    resolve_order_delay,
)
from app.utils.api_response import success_response

router = APIRouter(prefix="/alerts", tags=["alerts"])

MODULE = "alerts"


@router.post("", response_model=AlertRead)
def create_alert_endpoint(
    payload: AlertCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> AlertRead:
    try:
        payload.tenant_id = user.tenant_id
        if not payload.created_by:
            payload.created_by = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email or "HR Manager"
        return create_alert(db, payload)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error creating alert in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create alert in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create alert",
        ) from exc


@router.get("", response_model=AlertListResponse)
def list_alerts_endpoint(
    user: User = Depends(require_permission(MODULE)),
    alert_type: str | None = Query(None),
    status: str | None = Query(None),
    module: str | None = Query(None),
    severity: str | None = Query(None),
    is_read: bool | None = Query(None),
    search: str | None = Query(None),
    date_from: datetime | None = Query(None),
    date_to: datetime | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    sync_low_stock: bool = Query(False),
    db: Session = Depends(get_db),
) -> AlertListResponse:
    try:
        if sync_low_stock:
            sync_low_stock_alerts(db, user.tenant_id)
        items, total, unread = list_alerts(
            db,
            user.tenant_id,
            alert_type,
            status,
            module=module,
            severity=severity,
            is_read=is_read,
            search=search,
            date_from=date_from,
            date_to=date_to,
            user=user,
            page=page,
            page_size=page_size,
        )
        return AlertListResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            unread_count=unread,
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error listing alerts in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to list alerts in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list alerts",
        ) from exc


@router.get("/notifications")
def notifications_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Legacy alias — prefer GET /api/notifications."""
    data = NotificationManagementService(db, user).list_notifications()
    return success_response("Notifications retrieved", data)


@router.post("/notifications/read")
def notifications_read_endpoint(
    payload: NotificationReadRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.notification_management_service import mark_notifications_read

    data = mark_notifications_read(db, user, payload.notification_ids)
    return success_response("Notifications marked as read", data)


@router.delete("/notifications/clear")
def notifications_clear_endpoint(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = NotificationManagementService(db, user).clear_all()
    return success_response("All notifications cleared", data)


@router.post("/sync-low-stock", response_model=list[AlertRead])
def sync_low_stock_endpoint(
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> list[AlertRead]:
    try:
        return sync_low_stock_alerts(db, tenant_id)
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error syncing low stock alerts in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to sync low stock alerts in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync low stock alerts",
        ) from exc


@router.post("/mark-all-read")
def mark_all_read_endpoint(
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        updated = mark_all_alerts_read(db, user.tenant_id, user)
        return {"updated": updated}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error marking all alerts read in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to mark all alerts read in API: %s", exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all alerts as read",
        ) from exc


class OrderDelayFollowUp(BaseModel):
    note: str = Field(..., min_length=1, max_length=2000)


@router.get("/order-delays")
def list_order_delays_endpoint(
    user: User = Depends(require_permission(MODULE)),
    search: str | None = Query(None),
    customer: str | None = Query(None),
    severity: str | None = Query(None),
    stage: str | None = Query(None),
    duration: str | None = Query(None),
    delivery_from: date | None = Query(None),
    delivery_to: date | None = Query(None),
    timing: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return list_order_delays(
        db,
        user.tenant_id,
        search=search,
        customer=customer,
        severity=severity,
        stage=stage,
        duration=duration,
        delivery_from=delivery_from,
        delivery_to=delivery_to,
        timing=timing,
        page=page,
        page_size=page_size,
    )


@router.get("/order-delays/{order_id}")
def get_order_delay_endpoint(
    order_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return get_order_delay(db, user.tenant_id, order_id)


@router.post("/order-delays/{order_id}/follow-up")
def order_delay_follow_up_endpoint(
    order_id: int,
    payload: OrderDelayFollowUp,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return add_follow_up(db, user.tenant_id, order_id, payload.note, user)


@router.post("/order-delays/{order_id}/acknowledge")
def order_delay_acknowledge_endpoint(
    order_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return acknowledge_order_delay(db, user.tenant_id, order_id, user)


@router.post("/order-delays/{order_id}/resolve")
def order_delay_resolve_endpoint(
    order_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return resolve_order_delay(db, user.tenant_id, order_id, user)


@router.post("/order-delays/{order_id}/notify")
def order_delay_notify_endpoint(
    order_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    return notify_assigned_user(db, user.tenant_id, order_id, user)


@router.put("/{alert_id}/read", response_model=AlertRead)
def mark_read_endpoint(
    alert_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
) -> AlertRead:
    try:
        alert = mark_alert_read(db, alert_id, user.tenant_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error marking alert read id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to mark alert read id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark alert as read",
        ) from exc


@router.get("/{alert_id}", response_model=AlertRead)
def get_alert_endpoint(
    alert_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
) -> AlertRead:
    try:
        alert = get_alert(db, alert_id, tenant_id)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error getting alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve alert",
        ) from exc


@router.post("/{alert_id}/acknowledge")
def acknowledge_alert_endpoint(
    alert_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        userName = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
        alert = acknowledge_alert(db, alert_id, tenant_id, acknowledged_by=userName)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return {"acknowledged": True, "id": alert.id}
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error acknowledging alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to acknowledge alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to acknowledge alert",
        ) from exc


@router.put("/{alert_id}/acknowledge", response_model=AlertRead)
def acknowledge_alert_put_endpoint(
    alert_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertRead:
    try:
        userName = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
        alert = acknowledge_alert(db, alert_id, tenant_id, acknowledged_by=userName)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error acknowledging alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to acknowledge alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to acknowledge alert",
        ) from exc


@router.put("/{alert_id}/resolve", response_model=AlertRead)
def resolve_alert_endpoint(
    alert_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> AlertRead:
    try:
        userName = getattr(user, "full_name", None) or getattr(user, "name", None) or user.email
        alert = resolve_alert(db, alert_id, tenant_id, resolved_by=userName)
        if not alert:
            raise HTTPException(404, "Alert not found")
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error resolving alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to resolve alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve alert",
        ) from exc


@router.delete("/{alert_id}")
def delete_alert_endpoint(
    alert_id: int,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    try:
        if not user_is_admin(user):
            raise HTTPException(403, "Only administrators can delete alerts")
        if not delete_alert(db, alert_id, user.tenant_id):
            raise HTTPException(404, "Alert not found")
        return {"deleted": True, "id": alert_id}
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        logger.exception("Integrity constraint violation deleting alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_409_CONFLICT,
            detail="Cannot delete alert: it is referenced by another record.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error deleting alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete alert id=%s in API: %s", alert_id, exc)
        raise HTTPException(
            status_code=http_status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete alert",
        ) from exc
