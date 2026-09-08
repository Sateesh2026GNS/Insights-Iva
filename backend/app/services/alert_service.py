import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session, joinedload

logger = logging.getLogger(__name__)

from app.core.permissions import get_role_names, user_is_admin
from app.models.alert import Alert
from app.models.user import User
from app.schemas.alert import AlertCreate
from app.services.alert_event_service import DEFAULT_LINKS, emit_alert, fanout_alert_notifications
from app.services.inventory_service import get_inventory_dashboard


def create_alert(db: Session, payload: AlertCreate, fanout: bool = True) -> Alert:
    if not payload.title or not str(payload.title).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Alert title cannot be empty or whitespace-only",
        )
    try:
        data = payload.model_dump()
        if not data.get("triggered_at"):
            data["triggered_at"] = datetime.now(timezone.utc)
        if not data.get("tenant_id"):
            data["tenant_id"] = 1
        a = Alert(**data)
        db.add(a)
        db.flush()
        fanout_alert_notifications(db, a)
        db.commit()
        db.refresh(a)
        return a
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during create_alert: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to create alert: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create alert",
        ) from exc



def list_alerts(
    db: Session,
    tenant_id: int,
    alert_type: str | None = None,
    status_val: str | None = None,
    *,
    module: str | None = None,
    severity: str | None = None,
    is_read: bool | None = None,
    search: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    user: User | None = None,
    page: int = 1,
    page_size: int = 50,
) -> tuple[list[Alert], int, int]:
    """Return (items, total, unread_count) with optional role-based filtering."""
    try:
        stmt = select(Alert).where(Alert.tenant_id == tenant_id)
        if alert_type:
            stmt = stmt.where(Alert.alert_type == alert_type)
        if status_val:
            stmt = stmt.where(Alert.status == status_val)
        if module:
            stmt = stmt.where(Alert.module == module)
        if severity:
            stmt = stmt.where(Alert.severity == severity)
        if is_read is not None:
            stmt = stmt.where(Alert.is_read.is_(is_read))
        if date_from:
            stmt = stmt.where(Alert.triggered_at >= date_from)
        if date_to:
            stmt = stmt.where(Alert.triggered_at <= date_to)
        if search:
            q = f"%{search.strip()}%"
            stmt = stmt.where(
                (Alert.title.ilike(q))
                | (Alert.message.ilike(q))
                | (Alert.alert_type.ilike(q))
            )

        rows = list(db.scalars(stmt.order_by(Alert.triggered_at.desc(), Alert.id.desc())).all())

        if user and not user_is_admin(user):
            role_names = {r.lower() for r in get_role_names(user)}
            filtered = []
            for a in rows:
                if not a.target_role:
                    filtered.append(a)
                    continue
                targets = {t.strip().lower() for t in a.target_role.split(",") if t.strip()}
                if targets & role_names:
                    filtered.append(a)
            rows = filtered

        unread = sum(1 for a in rows if not a.is_read and a.status == "active")
        total = len(rows)
        page = max(1, page)
        page_size = max(1, min(page_size, 200))
        start = (page - 1) * page_size
        return rows[start : start + page_size], total, unread
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during list_alerts for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to list alerts for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list alerts",
        ) from exc


def get_alert(db: Session, alert_id: int, tenant_id: int) -> Alert | None:
    try:
        alert = db.get(Alert, alert_id)
        if not alert or alert.tenant_id != tenant_id:
            return None
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during get_alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve alert",
        ) from exc


def acknowledge_alert(db: Session, alert_id: int, tenant_id: int | None = None, acknowledged_by: str | None = None) -> Alert | None:
    try:
        alert = db.get(Alert, alert_id)
        if not alert or (tenant_id is not None and alert.tenant_id != tenant_id):
            return None
        alert.acknowledged_at = datetime.now(timezone.utc)
        alert.status = "acknowledged"
        if acknowledged_by:
            alert.acknowledged_by = acknowledged_by
        elif not alert.acknowledged_by:
            alert.acknowledged_by = "HR Manager"
        db.commit()
        db.refresh(alert)
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during acknowledge_alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to acknowledge alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to acknowledge alert",
        ) from exc


def resolve_alert(db: Session, alert_id: int, tenant_id: int | None = None, resolved_by: str | None = None) -> Alert | None:
    try:
        alert = db.get(Alert, alert_id)
        if not alert or (tenant_id is not None and alert.tenant_id != tenant_id):
            return None
        alert.status = "resolved"
        alert.is_read = True
        if not alert.acknowledged_at:
            alert.acknowledged_at = datetime.now(timezone.utc)
        if resolved_by:
            alert.acknowledged_by = resolved_by
        elif not alert.acknowledged_by:
            alert.acknowledged_by = "HR Manager"
        db.commit()
        db.refresh(alert)
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during resolve_alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to resolve alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to resolve alert",
        ) from exc


def mark_alert_read(db: Session, alert_id: int, tenant_id: int) -> Alert | None:
    try:
        alert = get_alert(db, alert_id, tenant_id)
        if not alert:
            return None
        alert.is_read = True
        db.commit()
        db.refresh(alert)
        return alert
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during mark_alert_read id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to mark alert as read id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark alert as read",
        ) from exc


def mark_all_alerts_read(db: Session, tenant_id: int, user: User | None = None) -> int:
    try:
        stmt = select(Alert).where(Alert.tenant_id == tenant_id, Alert.is_read.is_(False))
        alerts = list(db.scalars(stmt).all())
        updated_count = 0
        for a in alerts:
            if user and not user_is_admin(user) and a.target_role:
                role_names = {r.lower() for r in get_role_names(user)}
                targets = {t.strip().lower() for t in a.target_role.split(",") if t.strip()}
                if not (targets & role_names):
                    continue
            a.is_read = True
            updated_count += 1
        db.commit()
        return updated_count
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during mark_all_alerts_read for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to mark all alerts as read for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to mark all alerts as read",
        ) from exc


def delete_alert(db: Session, alert_id: int, tenant_id: int) -> bool:
    try:
        alert = get_alert(db, alert_id, tenant_id)
        if not alert:
            return False
        db.delete(alert)
        db.commit()
        return True
    except HTTPException:
        raise
    except IntegrityError as exc:
        db.rollback()
        logger.exception(
            "Integrity constraint violation deleting alert id=%s (referenced by another record): %s",
            alert_id,
            exc,
        )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete alert: it is referenced by another record.",
        ) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during delete_alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to delete alert id=%s: %s", alert_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete alert",
        ) from exc


def sync_low_stock_alerts(db: Session, tenant_id: int) -> list[Alert]:
    """Create, update, or resolve low-stock alerts from current inventory levels."""
    try:
        dashboard = get_inventory_dashboard(db, tenant_id)
        low_items = [i for i in dashboard if i.get("needs_reorder")]

        existing = list(
            db.scalars(
                select(Alert).where(
                    Alert.tenant_id == tenant_id,
                    Alert.alert_type == "low_stock",
                    Alert.reference_type == "inventory_item",
                )
            ).all()
        )
        existing_by_ref = {a.reference_id: a for a in existing if a.reference_id is not None}

        current_ids: set[int] = set()
        for item in low_items:
            item_id = item["id"]
            current_ids.add(item_id)
            qty = item.get("total_quantity") or 0
            alert_type = "out_of_stock" if qty == 0 else "low_stock"
            title = f"{'Out of stock' if qty == 0 else 'Low stock'}: {item['name']}"
            message = (
                f"{item['name']} ({item['sku']}) has {qty} in stock; "
                f"reorder level is {item['reorder_level']}."
            )
            severity = "critical" if qty == 0 else "high"
            link = f"/inventory/raw-materials?item={item_id}"
            if item_id in existing_by_ref:
                alert = existing_by_ref[item_id]
                if alert.status == "active":
                    alert.title = title
                    alert.message = message
                    alert.severity = severity
            else:
                emit_alert(
                    db,
                    tenant_id=tenant_id,
                    alert_type=alert_type,
                    title=title,
                    message=message,
                    severity=severity,
                    module="inventory",
                    link=link,
                    reference_type="inventory_item",
                    reference_id=item_id,
                    metadata={"sku": item.get("sku"), "quantity": qty},
                    created_by="Inventory Sync",
                    commit=False,
                )

        db.commit()
        return list_alerts(db, tenant_id, alert_type="low_stock")
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during sync_low_stock_alerts for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to sync low stock alerts for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to sync low stock alerts",
        ) from exc
