"""Supplier & Vendor Master Tracker aggregates.

Counts come from the existing ``suppliers`` table and recent purchase orders.
Trade buckets are derived from country and vendor type. Historical percentage
changes are not invented when no prior snapshot exists.
"""

from __future__ import annotations

from datetime import date, datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.inventory import Supplier
from app.models.procurement import PurchaseOrder
from app.schemas.vendor import (
    SupplierTrackerRead,
    TrackerActivityRead,
    TrackerCountRead,
    TrackerHeaderRead,
    TrackerKpiRead,
    TrackerRatingRead,
)

SERVICE_VENDOR_TYPES = frozenset({"Service Provider", "Transport & Logistics"})
_ACTIVITY_LIMIT = 8


def _text(value) -> str:
    return (value or "").strip()


def _country_label(supplier) -> str:
    country = _text(getattr(supplier, "country", None))
    return country or "Not specified"


def _is_foreign(supplier) -> bool:
    country = _text(getattr(supplier, "country", None)).lower()
    return bool(country) and country != "india"


def _is_service(supplier) -> bool:
    return _text(getattr(supplier, "vendor_type", None)) in SERVICE_VENDOR_TYPES


def trade_bucket(supplier) -> str:
    """Map a saved vendor onto the tracker trade groups."""
    if _is_foreign(supplier) and _is_service(supplier):
        return "Export Service Vendors"
    if _is_foreign(supplier):
        return "Import Suppliers"
    if _is_service(supplier):
        return "Domestic Service Vendors"
    return "Others"


def is_compliant(supplier) -> bool:
    """Approved, active, and identified with a GSTIN or PAN."""
    status = _text(getattr(supplier, "status", None)).lower()
    approval = _text(getattr(supplier, "approval_status", None)).lower()
    has_tax_id = bool(_text(getattr(supplier, "gstin", None)) or _text(getattr(supplier, "pan", None)))
    return status == "active" and approval == "approved" and has_tax_id


def is_at_risk(supplier) -> bool:
    """Blacklisted, still pending approval, or rated below 3."""
    status = _text(getattr(supplier, "status", None)).lower()
    approval = _text(getattr(supplier, "approval_status", None)).lower()
    if status == "blacklisted" or approval == "pending":
        return True
    rating = getattr(supplier, "rating", None)
    return rating is not None and float(rating) < 3


def _as_date(value) -> date | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _as_datetime(value) -> datetime | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value
    if isinstance(value, date):
        return datetime(value.year, value.month, value.day, tzinfo=timezone.utc)
    return None


def _count_rows(labels: list[str]) -> list[TrackerCountRead]:
    counts: dict[str, int] = {}
    for label in labels:
        counts[label] = counts.get(label, 0) + 1
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0].lower()))
    return [TrackerCountRead(label=label, count=count) for label, count in ordered]


def build_supplier_tracker(suppliers, purchase_orders=None) -> SupplierTrackerRead:
    rows = list(suppliers or [])
    orders = list(purchase_orders or [])
    total = len(rows)
    active = sum(1 for row in rows if _text(getattr(row, "status", None)).lower() == "active")
    imports = sum(1 for row in rows if trade_bucket(row) == "Import Suppliers")
    exports = sum(1 for row in rows if trade_bucket(row) == "Export Service Vendors")
    compliant = sum(1 for row in rows if is_compliant(row))
    at_risk = sum(1 for row in rows if is_at_risk(row))
    countries = {
        _text(getattr(row, "country", None))
        for row in rows
        if _text(getattr(row, "country", None))
    }
    ratings = [float(row.rating) for row in rows if getattr(row, "rating", None) is not None]
    average = round(sum(ratings) / len(ratings), 2) if ratings else None
    updated = [
        stamp
        for stamp in (_as_datetime(getattr(row, "updated_at", None)) for row in rows)
        if stamp is not None
    ]
    last_updated = max(updated) if updated else None

    rating_buckets = {star: 0 for star in range(1, 6)}
    for rating in ratings:
        star = max(1, min(5, int(round(rating))))
        rating_buckets[star] += 1

    activities: list[tuple[date, TrackerActivityRead]] = []
    for row in rows:
        created = _as_date(getattr(row, "created_at", None))
        updated_on = _as_date(getattr(row, "updated_at", None))
        name = _text(getattr(row, "name", None)) or "Supplier"
        status = _text(getattr(row, "status", None)) or "active"
        detail = _text(getattr(row, "vendor_type", None)) or _text(getattr(row, "category", None)) or "Vendor master"
        if created:
            activities.append(
                (
                    created,
                    TrackerActivityRead(
                        occurred_on=created,
                        supplier_name=name,
                        activity="Supplier created",
                        details=detail,
                        status=status.replace("_", " ").title(),
                    ),
                )
            )
        if updated_on and updated_on != created:
            activities.append(
                (
                    updated_on,
                    TrackerActivityRead(
                        occurred_on=updated_on,
                        supplier_name=name,
                        activity="Supplier updated",
                        details=detail,
                        status=status.replace("_", " ").title(),
                    ),
                )
            )

    for order in orders:
        occurred = _as_date(getattr(order, "order_date", None))
        if not occurred:
            continue
        po_status = _text(getattr(order, "status", None)) or "draft"
        activities.append(
            (
                occurred,
                TrackerActivityRead(
                    occurred_on=occurred,
                    supplier_name=_text(getattr(order, "supplier_name", None)) or "Supplier",
                    activity="Purchase order",
                    details=_text(getattr(order, "po_number", None)) or "Purchase order",
                    status=po_status.replace("_", " ").title(),
                ),
            )
        )

    activities.sort(key=lambda item: item[0], reverse=True)
    recent = [item[1] for item in activities[:_ACTIVITY_LIMIT]]

    return SupplierTrackerRead(
        header=TrackerHeaderRead(
            total_suppliers=total,
            active_suppliers=active,
            import_suppliers=imports,
            export_service_vendors=exports,
            countries_served=len(countries),
            suppliers_at_risk=at_risk,
            last_updated=last_updated,
        ),
        kpis=[
            TrackerKpiRead(key="total", label="Total Suppliers", value=total, note="Suppliers on the vendor master"),
            TrackerKpiRead(key="active", label="Active Suppliers", value=active, note="Status is active"),
            TrackerKpiRead(key="import", label="Import Suppliers", value=imports, note="Country outside India"),
            TrackerKpiRead(
                key="export",
                label="Export Service Vendors",
                value=exports,
                note="Service vendors outside India",
            ),
            TrackerKpiRead(
                key="rating",
                label="Average Supplier Rating",
                value=average,
                unit="/ 5" if average is not None else None,
                note="Average of recorded ratings" if average is not None else "No ratings recorded",
            ),
            TrackerKpiRead(
                key="compliant",
                label="Compliant Suppliers",
                value=compliant,
                note="Approved, active, with GSTIN or PAN",
            ),
        ],
        by_country=_count_rows([_country_label(row) for row in rows]),
        by_trade_type=_count_rows([trade_bucket(row) for row in rows]),
        by_rating=[TrackerRatingRead(stars=star, count=rating_buckets[star]) for star in range(5, 0, -1)],
        by_category=_count_rows(
            [
                _text(getattr(row, "category", None)) or "Uncategorised"
                for row in rows
            ]
        ),
        by_payment_terms=_count_rows(
            [
                _text(getattr(row, "payment_terms", None)) or "Not set"
                for row in rows
            ]
        ),
        activities=recent,
    )


class _PurchaseEvent:
    def __init__(self, order_date, supplier_name, po_number, status):
        self.order_date = order_date
        self.supplier_name = supplier_name
        self.po_number = po_number
        self.status = status


def get_supplier_vendor_tracker(db: Session, tenant_id: int) -> SupplierTrackerRead:
    suppliers = list(
        db.scalars(
            select(Supplier)
            .where(Supplier.tenant_id == tenant_id, Supplier.is_deleted.is_(False))
            .order_by(Supplier.name)
        ).all()
    )
    order_rows = db.execute(
        select(PurchaseOrder, Supplier.name)
        .join(Supplier, Supplier.id == PurchaseOrder.supplier_id)
        .where(
            PurchaseOrder.tenant_id == tenant_id,
            Supplier.tenant_id == tenant_id,
            Supplier.is_deleted.is_(False),
        )
        .order_by(PurchaseOrder.order_date.desc())
        .limit(12)
    ).all()
    events = [
        _PurchaseEvent(order.order_date, name, order.po_number, order.status)
        for order, name in order_rows
    ]
    return build_supplier_tracker(suppliers, events)
