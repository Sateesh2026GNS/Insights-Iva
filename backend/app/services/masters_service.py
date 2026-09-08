import logging

from fastapi import HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.repositories.bom_repository import BomRepository
from app.repositories.machine_repository import MachineRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.machine import MachineCreateExtended, MachineFullUpdate
from app.schemas.product import BomItemCreate, ProductCreate, ProductUpdate
from app.schemas.vendor import VendorBulkImportRequest, VendorCreate, VendorUpdate
from app.services.machine_service import (
    create_machine_extended,
    delete_machine_full,
    get_machine_detail,
    list_machines_enriched,
    update_machine_full,
)
from app.services.product_service import (
    add_bom_item,
    create_product,
    delete_bom_item,
    delete_product,
    get_product,
    list_bom,
    list_products,
    update_product,
)


class MastersService:
    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id
        self.products = ProductRepository(db, tenant_id)
        self.bom = BomRepository(db, tenant_id)
        self.machines = MachineRepository(db, tenant_id)

    # ── Products ───────────────────────────────────────────────────────────

    @staticmethod
    def _serialize_product(p) -> dict:
        """Serialize all stored product fields to a dict, incl. Inventory V2 fields."""
        code = p.sku or (f"PRD{str(p.id).zfill(3)}" if p.id else "")
        return {
            "id": p.id,
            "sku": p.sku or code,
            "product_code": code,
            "name": p.name,
            "description": p.description,
            "unit": getattr(p, "unit", None) or "Pcs",
            "unit_cost": float(p.unit_cost) if p.unit_cost else None,
            "unit_price": float(p.unit_price) if p.unit_price else None,
            "purchase_price": float(p.unit_cost) if p.unit_cost else 0,
            "selling_price": float(p.unit_price) if p.unit_price else 0,
            "wholesale_price": float(p.wholesale_price) if getattr(p, "wholesale_price", None) else 0,
            "hsn_code": getattr(p, "hsn_code", None) or "",
            "category": getattr(p, "category", None) or "No Category",
            "gst_percent": float(p.gst_percent) if getattr(p, "gst_percent", None) is not None else 0,
            "cess_percent": float(p.cess_percent) if getattr(p, "cess_percent", None) is not None else 0,
            "min_stock": int(p.min_stock) if p.min_stock is not None else None,
            "max_stock": int(p.max_stock) if p.max_stock is not None else None,
            "current_stock": float(p.current_stock) if p.current_stock is not None else 0,
            "stock_value": float(p.current_stock or 0) * float(p.unit_price or 0),
            "created_at": p.created_at.isoformat() if getattr(p, "created_at", None) else None,
        }

    def list_products(self) -> list[dict]:
        return [
            self._serialize_product(p)
            for p in list_products(self.db, self.tenant_id)
        ]

    def get_product(self, product_id: int) -> dict | None:
        p = get_product(self.db, self.tenant_id, product_id)
        if not p:
            return None
        result = self._serialize_product(p)
        result["bom"] = [self.bom.enrich_item(b) for b in list_bom(self.db, self.tenant_id, p.id)]
        return result

    def create_product(self, payload: ProductCreate) -> dict:
        payload.tenant_id = self.tenant_id
        p = create_product(self.db, payload)
        return self._serialize_product(p)

    def update_product(self, product_id: int, payload: ProductUpdate) -> dict | None:
        p = update_product(self.db, self.tenant_id, product_id, payload)
        if not p:
            return None
        return self._serialize_product(p)

    def delete_product(self, product_id: int) -> bool:
        return delete_product(self.db, self.tenant_id, product_id)

    # ── BOM ────────────────────────────────────────────────────────────────

    def list_all_bom(self) -> list[dict]:
        return [self.bom.enrich_item(item) for item in self.bom.list_all()]

    def list_bom_for_product(self, product_id: int) -> list[dict]:
        return [self.bom.enrich_item(item) for item in list_bom(self.db, self.tenant_id, product_id)]

    def add_bom_line(self, payload: BomItemCreate) -> dict:
        payload.tenant_id = self.tenant_id
        item = add_bom_item(self.db, payload)
        return self.bom.enrich_item(item)

    def delete_bom_line(self, bom_id: int) -> bool:
        return delete_bom_item(self.db, self.tenant_id, bom_id)

    # ── Machines ───────────────────────────────────────────────────────────

    def list_machines(self) -> list[dict]:
        enriched = list_machines_enriched(self.db, self.tenant_id)
        return [m.model_dump(mode="json") for m in enriched]

    def get_machine(self, machine_id: int) -> dict | None:
        detail = get_machine_detail(self.db, self.tenant_id, machine_id)
        return detail.model_dump(mode="json") if detail else None

    def create_machine(self, payload: MachineCreateExtended) -> dict:
        payload.tenant_id = self.tenant_id
        m = create_machine_extended(self.db, payload)
        return {"id": m.id, "code": m.code, "name": m.name, "status": m.status}

    def update_machine(self, machine_id: int, payload: MachineFullUpdate) -> dict | None:
        m = update_machine_full(self.db, self.tenant_id, machine_id, payload)
        if not m:
            return None
        return {"id": m.id, "code": m.code, "name": m.name, "status": m.status}

    def delete_machine(self, machine_id: int) -> bool:
        return delete_machine_full(self.db, self.tenant_id, machine_id)

    # ── Vendors (Masters → Vendors page) ───────────────────────────────────

    def list_vendors(self, search: str | None = None) -> list[dict]:
        from app.services.vendor_service import list_vendors_enriched

        rows = list_vendors_enriched(self.db, self.tenant_id, search=search)
        return [row.model_dump(mode="json") for row in rows]

    def get_vendor(self, vendor_id: int) -> dict | None:
        from app.services.vendor_service import get_vendor_detail

        detail = get_vendor_detail(self.db, self.tenant_id, vendor_id)
        return detail.model_dump(mode="json") if detail else None

    def create_vendor(self, payload: VendorCreate, *, actor: str | None = None) -> dict:
        from app.services.vendor_service import _to_list_read, create_vendor

        payload.tenant_id = self.tenant_id
        supplier = create_vendor(self.db, payload, actor=actor)
        return _to_list_read(self.db, self.tenant_id, supplier).model_dump(mode="json")

    def update_vendor(
        self, vendor_id: int, payload: VendorUpdate, *, actor: str | None = None
    ) -> dict | None:
        from app.services.vendor_service import _to_list_read, update_vendor

        supplier = update_vendor(
            self.db, self.tenant_id, vendor_id, payload, actor=actor
        )
        if not supplier:
            return None
        return _to_list_read(self.db, self.tenant_id, supplier).model_dump(mode="json")

    def delete_vendor(self, vendor_id: int, *, actor: str | None = None) -> bool:
        from app.services.vendor_service import soft_delete_vendor

        supplier = soft_delete_vendor(
            self.db, self.tenant_id, vendor_id, actor=actor
        )
        return supplier is not None

    def bulk_import_vendors(
        self, rows: list[VendorCreate], *, actor: str | None = None
    ) -> dict:
        created = 0
        failed = 0
        errors: list[str] = []
        for idx, row in enumerate(rows, start=1):
            try:
                payload = row.model_copy()
                if not payload.contact:
                    payload.contact = payload.name
                payload.tenant_id = self.tenant_id
                self.create_vendor(payload, actor=actor)
                created += 1
            except HTTPException as exc:
                failed += 1
                errors.append(f"Row {idx}: {exc.detail}")
                try:
                    self.db.rollback()
                except Exception:
                    pass
            except (ValueError, KeyError) as exc:
                failed += 1
                errors.append(f"Row {idx}: {exc}")
                try:
                    self.db.rollback()
                except Exception:
                    pass
            except SQLAlchemyError as exc:
                logger.exception("Database error during bulk_import_vendors row %s: %s", idx, exc)
                failed += 1
                errors.append(f"Row {idx}: Database error or duplicate vendor entry.")
                try:
                    self.db.rollback()
                except Exception:
                    pass
            except Exception as exc:
                logger.exception("Unexpected error during bulk_import_vendors row %s: %s", idx, exc)
                failed += 1
                errors.append(f"Row {idx}: Invalid vendor data or import error.")
                try:
                    self.db.rollback()
                except Exception:
                    pass
        return {"created": created, "failed": failed, "errors": errors[:20]}
