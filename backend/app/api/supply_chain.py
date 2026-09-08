from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.permissions import tenant_scope
from app.models.inventory import Supplier
from app.models.procurement import GoodsReceipt, PurchaseOrder

router = APIRouter(prefix="/supply-chain", tags=["Supply Chain Management"])

MODULE = "procurement"


@router.get("/supplier-performance")
def get_supplier_performance(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Per-supplier PO count, total spend and received PO count."""
    suppliers = list(
        db.scalars(select(Supplier).where(Supplier.tenant_id == tenant_id)).all()
    )
    result = []
    for s in suppliers:
        po_count, total = db.execute(
            select(
                func.count(PurchaseOrder.id),
                func.coalesce(func.sum(PurchaseOrder.total_amount), 0),
            ).where(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.supplier_id == s.id,
            )
        ).one()
        received = db.scalar(
            select(func.count(PurchaseOrder.id)).where(
                PurchaseOrder.tenant_id == tenant_id,
                PurchaseOrder.supplier_id == s.id,
                PurchaseOrder.status == "received",
            )
        )
        result.append(
            {
                "supplier_id": s.id,
                "supplier": s.name,
                "purchase_orders": int(po_count or 0),
                "total_spend": float(total or 0),
                "received_orders": int(received or 0),
                "fulfilment_pct": (
                    round(int(received or 0) / int(po_count) * 100, 1)
                    if po_count
                    else 0
                ),
            }
        )
    result.sort(key=lambda r: r["total_spend"], reverse=True)
    return result


@router.get("/purchase-forecast")
def get_purchase_forecast(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Open purchase orders that represent committed upcoming spend."""
    rows = db.execute(
        select(
            PurchaseOrder.id,
            PurchaseOrder.po_number,
            PurchaseOrder.expected_date,
            PurchaseOrder.status,
            PurchaseOrder.total_amount,
            Supplier.name,
        )
        .join(Supplier, PurchaseOrder.supplier_id == Supplier.id)
        .where(
            PurchaseOrder.tenant_id == tenant_id,
            PurchaseOrder.status.in_(("draft", "approved", "ordered")),
        )
        .order_by(PurchaseOrder.expected_date)
    ).all()
    return [
        {
            "id": r[0],
            "po_number": r[1],
            "expected_date": r[2].isoformat() if r[2] else None,
            "status": r[3],
            "amount": float(r[4] or 0),
            "supplier": r[5],
        }
        for r in rows
    ]


@router.get("/delivery-tracking")
def get_delivery_tracking(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """Purchase orders with their goods-receipt fulfilment state."""
    pos = list(
        db.scalars(
            select(PurchaseOrder).where(PurchaseOrder.tenant_id == tenant_id)
        ).all()
    )
    result = []
    for po in pos:
        receipts = db.scalar(
            select(func.count(GoodsReceipt.id)).where(
                GoodsReceipt.purchase_order_id == po.id,
                GoodsReceipt.tenant_id == tenant_id,
            )
        )
        result.append(
            {
                "po_number": po.po_number,
                "status": po.status,
                "order_date": po.order_date.isoformat() if po.order_date else None,
                "expected_date": po.expected_date.isoformat() if po.expected_date else None,
                "receipts": int(receipts or 0),
                "delivered": int(receipts or 0) > 0,
            }
        )
    return result


@router.get("/supply-reports")
def get_supply_reports(
    tenant_id: int = Depends(tenant_scope(MODULE)), db: Session = Depends(get_db)
):
    """High-level procurement totals for the tenant."""
    supplier_count = db.scalar(
        select(func.count(Supplier.id)).where(Supplier.tenant_id == tenant_id)
    )
    po_count, po_value = db.execute(
        select(
            func.count(PurchaseOrder.id),
            func.coalesce(func.sum(PurchaseOrder.total_amount), 0),
        ).where(PurchaseOrder.tenant_id == tenant_id)
    ).one()
    grn_count = db.scalar(
        select(func.count(GoodsReceipt.id)).where(GoodsReceipt.tenant_id == tenant_id)
    )
    return {
        "suppliers": int(supplier_count or 0),
        "purchase_orders": int(po_count or 0),
        "total_purchase_value": float(po_value or 0),
        "goods_receipts": int(grn_count or 0),
    }
