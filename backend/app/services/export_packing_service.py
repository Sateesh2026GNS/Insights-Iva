from __future__ import annotations

import json
from collections import defaultdict
from datetime import date
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models.export_packing import ExportPackingList, ExportPackingListCarton
from app.models.sales import DispatchShipment

DEFAULT_DOCUMENT_CHECKLIST = [
    {"id": "commercial_invoice", "label": "Commercial invoice verified against packing list", "checked": False},
    {"id": "packing_list_signed", "label": "Packing list signed by authorized signatory", "checked": False},
    {"id": "shipping_bill", "label": "Shipping bill / export documentation filed", "checked": False},
    {"id": "container_photos", "label": "Container loading photos captured", "checked": False},
    {"id": "seal_recorded", "label": "Container seal number recorded", "checked": False},
]

PACKAGE_LABELS = {
    "standard_carton": "Standard Carton",
    "reinforced_carton": "Reinforced Carton",
    "pallet_box": "Pallet Box",
    "wooden_crate": "Wooden Crate",
    "other": "Others",
}


def _dec(value) -> float:
    if value is None:
        return 0.0
    return float(value)


def _dims_label(c: ExportPackingListCarton) -> str:
    if c.dim_length_cm and c.dim_width_cm and c.dim_height_cm:
        return f"{_dec(c.dim_length_cm):g}x{_dec(c.dim_width_cm):g}x{_dec(c.dim_height_cm):g}"
    return "—"


def seed_demo_packing_list(db: Session, tenant_id: int) -> ExportPackingList:
    """First-visit starter data for export packing (tenant-scoped)."""
    header = ExportPackingList(
        tenant_id=tenant_id,
        packing_list_no="PL-2025-0428",
        shipment_no="EXP-2025-0428",
        destination="Rotterdam, Netherlands",
        container_no="MSKU1234567",
        dispatch_date=date(2025, 4, 28),
        status="completed",
        gross_weight_kg=Decimal("12450.00"),
        net_weight_kg=Decimal("10820.00"),
        cartons_planned=120,
        cartons_prepared=120,
        prepared_by_name="A. Kumar",
        remarks=(
            "All cartons to be loaded as per stacking plan. "
            "Ensure desiccant bags in each carton. "
            "Container seal no. to be recorded before dispatch."
        ),
    )
    db.add(header)
    db.flush()

    demo_rows = [
        ("C-001", "ELC-001", "LED Panel Light 18W", 50, 120, 130, 60, 40, 40, "ABC/ROT/001", "standard_carton"),
        ("C-002", "ELC-002", "LED Driver 24W", 100, 80, 95, 50, 40, 35, "ABC/ROT/002", "standard_carton"),
        ("C-003", "CAB-001", "Cable Harness Set", 75, 45, 52, 45, 35, 30, "ABC/ROT/003", "reinforced_carton"),
    ]
    for row in demo_rows:
        db.add(
            ExportPackingListCarton(
                tenant_id=tenant_id,
                packing_list_id=header.id,
                carton_no=row[0],
                sku_code=row[1],
                item_description=row[2],
                qty_pcs=row[3],
                net_weight_kg=Decimal(str(row[4])),
                gross_weight_kg=Decimal(str(row[5])),
                dim_length_cm=Decimal(str(row[6])),
                dim_width_cm=Decimal(str(row[7])),
                dim_height_cm=Decimal(str(row[8])),
                marks_numbers=row[9],
                package_type=row[10],
            )
        )
    db.commit()
    return db.execute(
        select(ExportPackingList)
        .where(ExportPackingList.id == header.id)
        .options(selectinload(ExportPackingList.cartons))
    ).scalar_one()


def _load_checklist(pl: ExportPackingList) -> list[dict]:
    if pl.document_checklist_json:
        try:
            data = json.loads(pl.document_checklist_json)
            if isinstance(data, list):
                return data
        except json.JSONDecodeError:
            pass
    return [dict(x) for x in DEFAULT_DOCUMENT_CHECKLIST]


def _save_checklist(pl: ExportPackingList, items: list[dict]) -> None:
    pl.document_checklist_json = json.dumps(items)


def get_packing_list(db: Session, tenant_id: int, packing_list_id: int) -> ExportPackingList:
    row = db.execute(
        select(ExportPackingList)
        .where(ExportPackingList.id == packing_list_id, ExportPackingList.tenant_id == tenant_id)
        .options(selectinload(ExportPackingList.cartons))
    ).scalar_one_or_none()
    if not row:
        raise ValueError("Packing list not found")
    return row


def list_dispatch_options(db: Session, tenant_id: int, limit: int = 25) -> list[dict]:
    rows = db.execute(
        select(DispatchShipment)
        .where(DispatchShipment.tenant_id == tenant_id)
        .order_by(DispatchShipment.dispatch_date.desc(), DispatchShipment.id.desc())
        .limit(limit)
    ).scalars().all()
    return [
        {
            "id": r.id,
            "dispatch_number": r.dispatch_number,
            "dispatch_date": r.dispatch_date.isoformat() if r.dispatch_date else None,
            "status": r.status,
            "box_count": r.box_count,
            "total_weight": _dec(r.total_weight) if r.total_weight is not None else None,
        }
        for r in rows
    ]


def create_packing_list(db: Session, tenant_id: int, payload: dict) -> ExportPackingList:
    row = ExportPackingList(tenant_id=tenant_id, **payload)
    _save_checklist(row, [dict(x) for x in DEFAULT_DOCUMENT_CHECKLIST])
    db.add(row)
    try:
        db.flush()
        pl_id = row.id
        db.commit()
    except Exception:
        db.rollback()
        raise
    return get_packing_list(db, tenant_id, pl_id)


def update_packing_list(db: Session, tenant_id: int, packing_list_id: int, payload: dict) -> ExportPackingList:
    pl = get_packing_list(db, tenant_id, packing_list_id)
    checklist = payload.pop("document_checklist", None)
    for key, value in payload.items():
        if hasattr(pl, key):
            setattr(pl, key, value)
    if checklist is not None:
        _save_checklist(pl, checklist)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise
    return get_packing_list(db, tenant_id, packing_list_id)


def create_packing_list_from_dispatch(db: Session, tenant_id: int, dispatch_id: int) -> ExportPackingList:
    dispatch = db.execute(
        select(DispatchShipment).where(
            DispatchShipment.id == dispatch_id,
            DispatchShipment.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if not dispatch:
        raise ValueError("Dispatch shipment not found")

    linked = db.execute(
        select(ExportPackingList).where(
            ExportPackingList.tenant_id == tenant_id,
            ExportPackingList.dispatch_shipment_id == dispatch_id,
        )
    ).scalar_one_or_none()
    if linked:
        return get_packing_list(db, tenant_id, linked.id)

    pl_no = f"PL-{dispatch.dispatch_number}"
    existing = db.scalar(
        select(func.count())
        .select_from(ExportPackingList)
        .where(ExportPackingList.tenant_id == tenant_id, ExportPackingList.packing_list_no == pl_no)
    )
    if existing:
        pl_no = f"{pl_no}-{dispatch.id}"
    return create_packing_list(
        db,
        tenant_id,
        {
            "packing_list_no": pl_no,
            "shipment_no": dispatch.dispatch_number,
            "dispatch_date": dispatch.dispatch_date,
            "cartons_planned": dispatch.box_count or 0,
            "cartons_prepared": 0,
            "gross_weight_kg": dispatch.total_weight,
            "remarks": dispatch.notes,
            "status": "in_progress",
            "dispatch_shipment_id": dispatch.id,
        },
    )


def add_carton(db: Session, tenant_id: int, packing_list_id: int, payload: dict) -> ExportPackingListCarton:
    pl = get_packing_list(db, tenant_id, packing_list_id)
    carton = ExportPackingListCarton(tenant_id=tenant_id, packing_list_id=pl.id, **payload)
    db.add(carton)
    try:
        db.flush()
        pl.cartons_prepared = len(pl.cartons or []) + 1
        db.commit()
        db.refresh(carton)
    except Exception:
        db.rollback()
        raise
    return carton


def update_carton(db: Session, tenant_id: int, carton_id: int, payload: dict) -> tuple[ExportPackingListCarton, int]:
    carton = db.execute(
        select(ExportPackingListCarton).where(
            ExportPackingListCarton.id == carton_id,
            ExportPackingListCarton.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if not carton:
        raise ValueError("Carton not found")
    pl_id = carton.packing_list_id
    for key, value in payload.items():
        if key in payload and hasattr(carton, key):
            setattr(carton, key, value)
    try:
        db.commit()
        db.refresh(carton)
    except Exception:
        db.rollback()
        raise
    return carton, pl_id


def delete_carton(db: Session, tenant_id: int, carton_id: int) -> None:
    carton = db.execute(
        select(ExportPackingListCarton).where(
            ExportPackingListCarton.id == carton_id,
            ExportPackingListCarton.tenant_id == tenant_id,
        )
    ).scalar_one_or_none()
    if not carton:
        raise ValueError("Carton not found")
    pl_id = carton.packing_list_id
    db.delete(carton)
    try:
        db.flush()
        pl = get_packing_list(db, tenant_id, pl_id)
        pl.cartons_prepared = len(pl.cartons or [])
        db.commit()
    except Exception:
        db.rollback()
        raise


def get_or_seed_latest_packing_list(
    db: Session,
    tenant_id: int,
    packing_list_id: int | None = None,
    seed_demo: bool = False,
) -> ExportPackingList | None:
    if packing_list_id:
        row = db.execute(
            select(ExportPackingList)
            .where(ExportPackingList.id == packing_list_id, ExportPackingList.tenant_id == tenant_id)
            .options(selectinload(ExportPackingList.cartons))
        ).scalar_one_or_none()
        if not row:
            raise ValueError("Packing list not found")
        return row

    count = db.scalar(
        select(func.count()).select_from(ExportPackingList).where(ExportPackingList.tenant_id == tenant_id)
    )
    if not count:
        if seed_demo:
            return seed_demo_packing_list(db, tenant_id)
        return None

    row = db.execute(
        select(ExportPackingList)
        .where(ExportPackingList.tenant_id == tenant_id)
        .order_by(ExportPackingList.dispatch_date.desc().nullslast(), ExportPackingList.id.desc())
        .limit(1)
        .options(selectinload(ExportPackingList.cartons))
    ).scalar_one()
    return row


def build_dashboard(
    db: Session,
    tenant_id: int,
    packing_list_id: int | None = None,
    seed_demo: bool = False,
) -> dict:
    pl = get_or_seed_latest_packing_list(db, tenant_id, packing_list_id, seed_demo=seed_demo)
    if not pl:
        return {
            "packing_list": None,
            "kpis": {},
            "cartons": [],
            "weight_summary": [],
            "package_type_distribution": [],
            "sku_quantity_summary": [],
            "item_master": [],
            "recent_packing_lists": [],
            "document_checklist": [dict(x) for x in DEFAULT_DOCUMENT_CHECKLIST],
            "validation": {"ok": False, "messages": ["No packing list yet. Create one or link a dispatch shipment."]},
        }
    cartons = sorted(pl.cartons or [], key=lambda c: c.carton_no)

    sku_qty: dict[str, int] = defaultdict(int)
    for c in cartons:
        key = c.sku_code or c.item_description
        sku_qty[key] += int(c.qty_pcs or 0)

    package_counts: dict[str, int] = defaultdict(int)
    for c in cartons:
        package_counts[c.package_type or "other"] += 1

    total_net = sum(_dec(c.net_weight_kg) for c in cartons) or _dec(pl.net_weight_kg)
    total_gross = sum(_dec(c.gross_weight_kg) for c in cartons) or _dec(pl.gross_weight_kg)
    packaging_weight = max(total_gross - total_net, 0)
    gross_for_pct = total_gross or 1.0

    unique_skus = len({c.sku_code for c in cartons if c.sku_code})

    item_master_map: dict[str, dict] = {}
    for c in cartons:
        sku = c.sku_code or "—"
        if sku not in item_master_map:
            item_master_map[sku] = {
                "sku_code": c.sku_code,
                "item_description": c.item_description,
                "total_qty": 0,
                "carton_count": 0,
            }
        item_master_map[sku]["total_qty"] += int(c.qty_pcs or 0)
        item_master_map[sku]["carton_count"] += 1

    recent = db.execute(
        select(ExportPackingList)
        .where(ExportPackingList.tenant_id == tenant_id)
        .order_by(ExportPackingList.dispatch_date.desc().nullslast(), ExportPackingList.id.desc())
        .limit(8)
    ).scalars().all()

    return {
        "packing_list": {
            "id": pl.id,
            "packing_list_no": pl.packing_list_no,
            "shipment_no": pl.shipment_no,
            "destination": pl.destination,
            "container_no": pl.container_no,
            "dispatch_date": pl.dispatch_date.isoformat() if pl.dispatch_date else None,
            "gross_weight_kg": _dec(pl.gross_weight_kg),
            "net_weight_kg": _dec(pl.net_weight_kg),
            "status": pl.status,
            "remarks": pl.remarks,
            "prepared_by_name": pl.prepared_by_name,
            "cartons_planned": pl.cartons_planned,
            "cartons_prepared": pl.cartons_prepared,
            "dispatch_shipment_id": pl.dispatch_shipment_id,
        },
        "kpis": {
            "total_packages": pl.cartons_prepared or len(cartons),
            "total_skus": unique_skus,
            "gross_weight_kg": _dec(pl.gross_weight_kg),
            "net_weight_kg": _dec(pl.net_weight_kg),
            "cartons_prepared": pl.cartons_prepared,
            "cartons_planned": pl.cartons_planned,
            "packing_status": pl.status,
        },
        "cartons": [
            {
                "id": c.id,
                "carton_no": c.carton_no,
                "sku_code": c.sku_code,
                "item_description": c.item_description,
                "qty_pcs": c.qty_pcs,
                "net_weight_kg": _dec(c.net_weight_kg),
                "gross_weight_kg": _dec(c.gross_weight_kg),
                "dimensions": _dims_label(c),
                "marks_numbers": c.marks_numbers,
            }
            for c in cartons
        ],
        "weight_summary": [
            {
                "label": "Total Net Weight",
                "weight_kg": round(total_net, 2),
                "pct_of_gross": round(100 * total_net / gross_for_pct, 1),
            },
            {
                "label": "Total Packaging Weight",
                "weight_kg": round(packaging_weight, 2),
                "pct_of_gross": round(100 * packaging_weight / gross_for_pct, 1),
            },
            {
                "label": "Total Gross Weight",
                "weight_kg": round(total_gross, 2),
                "pct_of_gross": 100.0,
            },
        ],
        "package_type_distribution": [
            {
                "name": PACKAGE_LABELS.get(k, k),
                "value": v,
                "pct": round(100 * v / max(len(cartons), 1), 1),
            }
            for k, v in package_counts.items()
        ],
        "sku_quantity_summary": [
            {"sku": sku, "qty": qty} for sku, qty in sorted(sku_qty.items(), key=lambda x: -x[1])[:8]
        ],
        "item_master": list(item_master_map.values()),
        "document_checklist": _load_checklist(pl),
        "recent_packing_lists": [
            {
                "id": r.id,
                "date": r.dispatch_date.isoformat() if r.dispatch_date else None,
                "packing_list_no": r.packing_list_no,
                "shipment_no": r.shipment_no,
                "destination": r.destination,
                "cartons": r.cartons_prepared,
                "status": r.status,
            }
            for r in recent
        ],
        "validation": validate_packing_list(pl, cartons),
    }


def validate_packing_list(pl: ExportPackingList, cartons: list[ExportPackingListCarton]) -> dict:
    messages: list[str] = []
    ok = True
    if pl.cartons_planned and pl.cartons_prepared != pl.cartons_planned:
        ok = False
        messages.append("Cartons prepared does not match planned count.")
    sum_gross = sum(_dec(c.gross_weight_kg) for c in cartons)
    if pl.gross_weight_kg and abs(sum_gross - _dec(pl.gross_weight_kg)) > 0.5:
        messages.append("Carton gross weights differ from header gross weight.")
    if not cartons:
        ok = False
        messages.append("No carton lines on this packing list.")
    return {"ok": ok, "messages": messages}
