from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import require_permission, tenant_scope
from app.models.sales import Customer, DispatchShipment, SalesOrder
from app.models.user import User
from app.schemas.sales_extended import (
    DeliveryChallanRead,
    DispatchListRead,
    DispatchShipmentCreate,
    DispatchSummaryRead,
)
from app.services.sales_extended_service import (
    get_dispatch_summary,
    list_dispatch_enriched,
)
from app.services.sales_service import (
    create_or_update_dispatch_shipment,
    get_delivery_challan,
)

router = APIRouter(prefix="/dispatch", tags=["Dispatch & Logistics"])

MODULE = "sales"


def _order_rows(db: Session, tenant_id: int, only_shipped: bool = False):
    stmt = (
        select(SalesOrder, Customer.name)
        .join(Customer, SalesOrder.customer_id == Customer.id)
        .where(SalesOrder.tenant_id == tenant_id)
    )
    if only_shipped:
        stmt = stmt.where(SalesOrder.shipped.is_(True))
    stmt = stmt.order_by(SalesOrder.order_date.desc())
    return db.execute(stmt).all()


@router.get("/summary", response_model=DispatchSummaryRead)
def dispatch_summary(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return get_dispatch_summary(db, tenant_id)


@router.get("/enriched", response_model=list[DispatchListRead])
def dispatch_enriched(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    return list_dispatch_enriched(db, tenant_id)


@router.post("/shipments")
def create_dispatch_shipment_endpoint(
    payload: DispatchShipmentCreate,
    user: User = Depends(require_permission(MODULE)),
    db: Session = Depends(get_db),
):
    shipment = create_or_update_dispatch_shipment(db, user.tenant_id, payload)
    return {
        "id": shipment.id,
        "dispatch_number": shipment.dispatch_number,
        "challan_number": shipment.dispatch_number,
        "sales_order_id": shipment.sales_order_id,
        "status": shipment.status,
        "courier": shipment.courier,
        "vehicle_number": shipment.vehicle_number,
        "driver_name": shipment.driver_name,
        "lr_number": shipment.lr_number,
        "dispatch_date": shipment.dispatch_date.isoformat() if shipment.dispatch_date else None,
        "eta": shipment.eta.isoformat() if shipment.eta else None,
        "notes": shipment.notes,
        "box_count": shipment.box_count,
        "total_weight": float(shipment.total_weight) if shipment.total_weight is not None else None,
    }


@router.get(
    "/sales-orders/{sales_order_id}/challan",
    response_model=DeliveryChallanRead,
)
def delivery_challan_endpoint(
    sales_order_id: int,
    tenant_id: int = Depends(tenant_scope(MODULE)),
    db: Session = Depends(get_db),
):
    challan = get_delivery_challan(db, tenant_id, sales_order_id)
    if not challan:
        raise HTTPException(404, "Sales order not found")
    return challan


@router.get("/dispatch-orders")
def get_dispatch_orders(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Sales orders that are packed and awaiting / undergoing dispatch."""
    rows = db.execute(
        select(SalesOrder, Customer.name)
        .join(Customer, SalesOrder.customer_id == Customer.id)
        .where(SalesOrder.tenant_id == tenant_id, SalesOrder.packed.is_(True))
        .order_by(SalesOrder.order_date.desc())
    ).all()
    return [
        {
            "id": so.id,
            "order_number": so.order_number,
            "customer": cust,
            "order_date": so.order_date.isoformat() if so.order_date else None,
            "total_amount": float(so.total_amount or 0),
            "packed": so.packed,
            "shipped": so.shipped,
            "status": "shipped" if so.shipped else "ready_to_dispatch",
        }
        for so, cust in rows
    ]


@router.get("/shipment-tracking")
def get_shipment_tracking(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Shipped sales orders with reference numbers used as tracking ids."""
    rows = _order_rows(db, tenant_id, only_shipped=True)
    shipments = {
        s.sales_order_id: s
        for s in db.scalars(
            select(DispatchShipment).where(DispatchShipment.tenant_id == tenant_id)
        ).all()
    }
    return [
        {
            "id": so.id,
            "order_number": so.order_number,
            "tracking_reference": (
                (shipments.get(so.id).lr_number if shipments.get(so.id) else None)
                or so.reference_number
                or f"SHIP-{so.id:05d}"
            ),
            "challan_number": (
                shipments[so.id].dispatch_number
                if so.id in shipments
                else f"DC-{so.order_number}"
            ),
            "customer": cust,
            "shipped": so.shipped,
            "order_date": so.order_date.isoformat() if so.order_date else None,
        }
        for so, cust in rows
    ]


@router.get("/delivery-status")
def get_delivery_status(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Aggregate delivery pipeline counts for the tenant."""
    base = select(func.count()).select_from(SalesOrder).where(
        SalesOrder.tenant_id == tenant_id
    )
    total = db.scalar(base) or 0
    packed = db.scalar(base.where(SalesOrder.packed.is_(True))) or 0
    shipped = db.scalar(base.where(SalesOrder.shipped.is_(True))) or 0
    return {
        "total_orders": int(total),
        "pending": int(total - packed),
        "packed": int(packed),
        "shipped": int(shipped),
        "in_transit": int(packed - shipped if packed > shipped else 0),
    }


@router.get("/transport-details")
def get_transport_details(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Transport manifest derived from shipped orders grouped by customer."""
    rows = _order_rows(db, tenant_id, only_shipped=True)
    by_customer: dict[str, dict] = {}
    for so, cust in rows:
        entry = by_customer.setdefault(
            cust, {"customer": cust, "shipments": 0, "total_value": 0.0}
        )
        entry["shipments"] += 1
        entry["total_value"] += float(so.total_amount or 0)
    return list(by_customer.values())
