"""Tenant-scoped product related records for Product Detail views."""

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.models.bom import BillOfMaterial
from app.models.inventory import InventoryItem, Supplier, VendorProduct
from app.models.procurement import PurchaseOrder, PurchaseOrderLine
from app.models.product import Product
from app.models.production import DailyProductionReport, ProductionOrder
from app.models.security import AccessLog
from app.models.sales import Customer, SalesOrder, SalesOrderLine
from app.models.user import User


def _date(value):
    return value.isoformat() if value is not None else None


def _number(value):
    return float(value) if value is not None else 0.0


def _require_product(db: Session, tenant_id: int, product_id: int) -> Product:
    product = db.scalars(
        select(Product).where(
            Product.id == product_id,
            Product.tenant_id == tenant_id,
        )
    ).first()
    if not product:
        from fastapi import HTTPException

        raise HTTPException(status_code=404, detail="Product not found")
    return product


def list_product_bom(db: Session, tenant_id: int, product_id: int) -> list[dict]:
    _require_product(db, tenant_id, product_id)
    rows = db.scalars(
        select(BillOfMaterial)
        .where(
            BillOfMaterial.tenant_id == tenant_id,
            BillOfMaterial.product_id == product_id,
        )
        .order_by(BillOfMaterial.id)
    ).all()
    result = []
    for row in rows:
        component = db.scalars(
            select(Product).where(
                Product.id == row.component_product_id,
                Product.tenant_id == tenant_id,
            )
        ).first()
        qty = _number(row.quantity)
        unit_cost = _number(component.unit_cost) if component else 0.0
        result.append(
            {
                "id": row.id,
                "component_product_id": row.component_product_id,
                "component_name": component.name if component else "Unknown product",
                "component_sku": component.sku if component else None,
                "quantity": qty,
                "unit": row.unit,
                "unit_cost": unit_cost,
                "total_cost": round(qty * unit_cost, 2),
            }
        )
    return result


def list_product_suppliers(db: Session, tenant_id: int, product_id: int) -> list[dict]:
    _require_product(db, tenant_id, product_id)
    rows = db.execute(
        select(Supplier, VendorProduct)
        .join(VendorProduct, VendorProduct.vendor_id == Supplier.id)
        .where(
            VendorProduct.tenant_id == tenant_id,
            VendorProduct.product_id == product_id,
            Supplier.tenant_id == tenant_id,
        )
        .order_by(Supplier.name)
    ).all()
    suppliers = {
        supplier.id: {
            "id": supplier.id,
            "vendor_code": supplier.vendor_code,
            "name": supplier.name,
            "contact": supplier.contact,
            "email": supplier.email,
            "phone": supplier.phone,
            "status": supplier.status,
            "source": "Product supplier link",
        }
        for supplier, _link in rows
    }
    po_suppliers = db.scalars(
        select(Supplier)
        .join(PurchaseOrder, PurchaseOrder.supplier_id == Supplier.id)
        .join(PurchaseOrderLine, PurchaseOrderLine.purchase_order_id == PurchaseOrder.id)
        .join(InventoryItem, InventoryItem.id == PurchaseOrderLine.item_id)
        .where(
            PurchaseOrder.tenant_id == tenant_id,
            Supplier.tenant_id == tenant_id,
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.product_id == product_id,
        )
        .distinct()
        .order_by(Supplier.name)
    ).all()
    for supplier in po_suppliers:
        suppliers.setdefault(
            supplier.id,
            {
                "id": supplier.id,
                "vendor_code": supplier.vendor_code,
                "name": supplier.name,
                "contact": supplier.contact,
                "email": supplier.email,
                "phone": supplier.phone,
                "status": supplier.status,
                "source": "Purchase history",
            },
        )
    return sorted(suppliers.values(), key=lambda row: row["name"].lower())


def list_product_purchase_history(
    db: Session, tenant_id: int, product_id: int
) -> list[dict]:
    _require_product(db, tenant_id, product_id)
    rows = db.execute(
        select(PurchaseOrderLine, PurchaseOrder, Supplier, InventoryItem)
        .join(PurchaseOrder, PurchaseOrder.id == PurchaseOrderLine.purchase_order_id)
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .join(InventoryItem, InventoryItem.id == PurchaseOrderLine.item_id)
        .where(
            PurchaseOrder.tenant_id == tenant_id,
            InventoryItem.tenant_id == tenant_id,
            InventoryItem.product_id == product_id,
        )
        .order_by(PurchaseOrder.order_date.desc(), PurchaseOrder.id.desc())
    ).all()
    return [
        {
            "id": line.id,
            "purchase_order_id": order.id,
            "order_number": order.po_number,
            "order_date": _date(order.order_date),
            "status": order.status,
            "supplier_name": supplier.name,
            "sku": item.sku,
            "quantity": _number(line.quantity),
            "unit": item.unit,
            "unit_price": _number(line.unit_price),
            "line_total": _number(line.line_total),
        }
        for line, order, supplier, item in rows
    ]


def list_product_sales_history(
    db: Session, tenant_id: int, product_id: int
) -> list[dict]:
    _require_product(db, tenant_id, product_id)
    rows = db.execute(
        select(SalesOrderLine, SalesOrder, Customer)
        .join(SalesOrder, SalesOrder.id == SalesOrderLine.sales_order_id)
        .join(Customer, Customer.id == SalesOrder.customer_id)
        .where(
            SalesOrder.tenant_id == tenant_id,
            Customer.tenant_id == tenant_id,
            SalesOrderLine.product_id == product_id,
        )
        .order_by(SalesOrder.order_date.desc(), SalesOrder.id.desc())
    ).all()
    return [
        {
            "id": line.id,
            "sales_order_id": order.id,
            "order_number": order.order_number,
            "order_date": _date(order.order_date),
            "status": order.status,
            "customer_name": customer.name,
            "quantity": _number(line.quantity),
            "unit": line.unit,
            "unit_price": _number(line.unit_price),
            "line_total": _number(line.line_total),
        }
        for line, order, customer in rows
    ]


def list_product_production_history(
    db: Session, tenant_id: int, product_id: int
) -> dict:
    _require_product(db, tenant_id, product_id)
    orders = db.scalars(
        select(ProductionOrder)
        .where(
            ProductionOrder.tenant_id == tenant_id,
            ProductionOrder.product_id == product_id,
        )
        .order_by(ProductionOrder.id.desc())
    ).all()
    reports = db.scalars(
        select(DailyProductionReport)
        .where(
            DailyProductionReport.tenant_id == tenant_id,
            DailyProductionReport.product_id == product_id,
        )
        .order_by(DailyProductionReport.report_date.desc(), DailyProductionReport.id.desc())
    ).all()
    return {
        "orders": [
            {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status,
                "planned_quantity": _number(order.planned_quantity),
                "actual_quantity": _number(order.actual_quantity),
                "start_date": _date(order.start_date),
                "due_date": _date(order.due_date),
                "sales_order_number": order.sales_order_number,
            }
            for order in orders
        ],
        "reports": [
            {
                "id": report.id,
                "report_date": _date(report.report_date),
                "planned_quantity": _number(report.planned_quantity),
                "produced_quantity": _number(report.produced_quantity),
                "scrap_quantity": _number(report.scrap_quantity),
                "notes": report.notes,
            }
            for report in reports
        ],
    }


def list_product_audit_logs(
    db: Session, tenant_id: int, product_id: int
) -> list[dict]:
    """Return tenant-scoped audit events recorded for a catalog product."""
    _require_product(db, tenant_id, product_id)
    rows = db.execute(
        select(AccessLog, User.full_name, User.email)
        .outerjoin(User, User.id == AccessLog.user_id)
        .where(
            AccessLog.tenant_id == tenant_id,
            AccessLog.resource_id == product_id,
            or_(
                func.lower(AccessLog.resource) == "product",
                func.lower(AccessLog.resource).like("%masters.products%"),
            ),
        )
        .order_by(AccessLog.logged_at.desc(), AccessLog.id.desc())
        .limit(200)
    ).all()
    return [
        {
            "id": log.id,
            "action": log.action,
            "user": full_name or email or "System",
            "role": log.role,
            "details": log.details,
            "logged_at": log.logged_at.isoformat() if log.logged_at else None,
        }
        for log, full_name, email in rows
    ]
