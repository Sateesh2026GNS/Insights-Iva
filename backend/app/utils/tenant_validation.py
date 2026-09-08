"""Shared tenant ownership checks for foreign-key references."""

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import InventoryItem, Warehouse
from app.models.product import Product
from app.models.sales import Customer, SalesOrder


def assert_warehouse_owned(db: Session, tenant_id: int, warehouse_id: int) -> Warehouse:
    wh = db.get(Warehouse, warehouse_id)
    if not wh or wh.tenant_id != tenant_id:
        raise HTTPException(404, "Warehouse not found")
    return wh


def assert_inventory_item_owned(db: Session, tenant_id: int, item_id: int) -> InventoryItem:
    item = db.get(InventoryItem, item_id)
    if not item or item.tenant_id != tenant_id:
        raise HTTPException(404, "Product not found")
    return item


def assert_customer_owned(db: Session, tenant_id: int, customer_id: int) -> Customer:
    customer = db.get(Customer, customer_id)
    if not customer or customer.tenant_id != tenant_id:
        raise HTTPException(404, "Customer not found")
    return customer


def assert_sales_order_owned(db: Session, tenant_id: int, sales_order_id: int) -> SalesOrder:
    order = db.get(SalesOrder, sales_order_id)
    if not order or order.tenant_id != tenant_id:
        raise HTTPException(404, "Sales order not found")
    return order


def assert_product_owned(db: Session, tenant_id: int, product_id: int) -> Product:
    product = db.scalars(
        select(Product).where(Product.id == product_id, Product.tenant_id == tenant_id)
    ).first()
    if not product:
        raise HTTPException(404, "Product not found")
    return product


def assert_stock_movement_refs(
    db: Session, tenant_id: int, warehouse_id: int, item_id: int
) -> tuple[Warehouse, InventoryItem]:
    wh = assert_warehouse_owned(db, tenant_id, warehouse_id)
    item = assert_inventory_item_owned(db, tenant_id, item_id)
    return wh, item
