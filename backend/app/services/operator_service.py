"""Operator module business logic — orchestrates repositories and existing services."""

from __future__ import annotations

import logging
from datetime import date, datetime, timezone, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_is_admin
from app.models.production import Batch, DailyProductionReport, WorkOrder
from app.models.user import User
from app.repositories.batch_repository import BatchRepository
from app.repositories.bom_repository import BomRepository
from app.repositories.machine_repository import MachineRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.production_plan_repository import ProductionPlanRepository
from app.repositories.work_order_repository import WorkOrderRepository
from app.schemas.operator import (
    BatchUpdateRequest,
    MachineBreakdownRequest,
    OperatorProfileRead,
    WorkOrderActionRequest,
    WorkOrderProgressRequest,
)
from app.services.allocation_service import get_allocation_list, get_allocation_summary
from app.services.batch_tracking_service import get_batch_detail, get_batch_summary, list_batches_enriched
from app.services.data_scope import operator_can_access_work_order
from app.services.notification_management_service import (
    NotificationManagementService,
    clear_all_notifications,
    get_user_notifications,
    mark_notifications_read,
)
from app.services.production_planning_service import get_production_order_detail, list_production_orders_enriched
from app.services.schedule_service import get_enhanced_timeline, get_schedule_dashboard
from app.services.work_order_service import (
    complete_work_order,
    get_work_order_detail,
    list_work_orders_enriched,
    pause_work_order,
    start_work_order,
)
logger = logging.getLogger(__name__)

RUNNING_STATUSES = ("in_progress", "running")
COMPLETED_STATUSES = ("completed", "closed", "done")


def _serialize_model(obj) -> dict | list | None:
    if obj is None:
        return None
    if isinstance(obj, list):
        return [_serialize_model(x) for x in obj]
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if hasattr(obj, "__dict__"):
        return {k: _serialize_model(v) for k, v in obj.__dict__.items() if not k.startswith("_")}
    return obj


def _resolve_work_order(
    repo: WorkOrderRepository,
    user: User,
    work_order_id: int | None,
    work_order_number: str | None,
) -> WorkOrder:
    wo = None
    if work_order_id:
        wo = repo.get_by_id(work_order_id)
    elif work_order_number:
        wo = repo.get_by_number(work_order_number, user=user)
    if not wo:
        raise HTTPException(status_code=404, detail="Work order not found")
    if not operator_can_access_work_order(user, wo):
        raise HTTPException(status_code=403, detail="You are not assigned to this work order")
    return wo


class OperatorService:
    def __init__(self, db: Session, tenant_id: int):
        self.db = db
        self.tenant_id = tenant_id
        self.work_orders = WorkOrderRepository(db, tenant_id)
        self.machines = MachineRepository(db, tenant_id)
        self.products = ProductRepository(db, tenant_id)
        self.bom = BomRepository(db, tenant_id)
        self.batches = BatchRepository(db, tenant_id)
        self.plans = ProductionPlanRepository(db, tenant_id)

    def _get_po(self, po_id: int | None):
        if not po_id:
            return None
        from app.models.production import ProductionOrder
        return self.db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.id == po_id,
                ProductionOrder.tenant_id == self.tenant_id,
            )
        ).first()

    def _get_product(self, product_id: int | None):
        if not product_id:
            return None
        from app.models.product import Product
        return self.db.scalars(
            select(Product).where(
                Product.id == product_id,
                Product.tenant_id == self.tenant_id,
            )
        ).first()

    # ── Dashboard ──────────────────────────────────────────────────────────

    def get_dashboard(self, user: User) -> dict:
        wo_summary = list_work_orders_enriched(self.db, self.tenant_id, user=user)
        return {
            "shop_floor": {},
            "work_orders_count": len(wo_summary),
            "running_machines": len(self.machines.list_by_status("running", "active")),
            "role": get_role_names(user),
        }

    def get_operator_dashboard(self, user: User) -> dict:
        assigned = self.work_orders.list_assigned(user)
        today = self.work_orders.list_today(user)
        return {
            "assigned_work_orders": len(assigned),
            "today_work_orders": len(today),
            "assigned": [_serialize_model(get_work_order_detail(self.db, self.tenant_id, w.id, user=user)) for w in assigned[:5]],
            "today": [_serialize_model(get_work_order_detail(self.db, self.tenant_id, w.id, user=user)) for w in today[:5]],
        }

    def get_dashboard_summary(self, user: User) -> dict:
        schedule = get_schedule_dashboard(self.db, self.tenant_id)
        batch_sum = get_batch_summary(self.db, self.tenant_id)
        return {
            "schedule": _serialize_model(schedule),
            "batches": _serialize_model(batch_sum),
            "notifications": get_user_notifications(self.db, user).get("count", 0),
        }

    def get_dashboard_today(self, user: User) -> dict:
        today_wos = self.work_orders.list_today(user)
        plans = self.plans.list_today()
        return {
            "work_orders": [_serialize_model(w) for w in list_work_orders_enriched(self.db, self.tenant_id, user=user) if w.id in {x.id for x in today_wos}],
            "production_plans": [
                {
                    "id": p.id,
                    "order_number": p.order_number,
                    "status": p.status,
                    "planned_quantity": float(p.planned_quantity),
                }
                for p in plans
            ],
            "date": date.today().isoformat(),
        }

    # ── Products ───────────────────────────────────────────────────────────

    def list_products(self) -> list[dict]:
        return [
            {
                "id": p.id,
                "sku": p.sku,
                "name": p.name,
                "description": p.description,
                "unit_cost": float(p.unit_cost) if p.unit_cost else None,
                "unit_price": float(p.unit_price) if p.unit_price else None,
            }
            for p in self.products.list_all()
        ]

    def get_product(self, product_id: int) -> dict:
        p = self.products.get_by_id(product_id)
        if not p:
            raise HTTPException(status_code=404, detail="Product not found")
        return {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "description": p.description,
            "unit_cost": float(p.unit_cost) if p.unit_cost else None,
            "unit_price": float(p.unit_price) if p.unit_price else None,
            "bom_items": [self.bom.enrich_item(b) for b in self.bom.list_by_product(p.id)],
        }

    def search_products(self, query: str) -> list[dict]:
        return [
            {"id": p.id, "sku": p.sku, "name": p.name}
            for p in self.products.search(query)
        ]

    # ── BOM ────────────────────────────────────────────────────────────────

    def list_bom(self) -> list[dict]:
        return [self.bom.enrich_item(item) for item in self.bom.list_all()]

    def get_bom(self, bom_id: int) -> dict:
        item = self.bom.get_by_id(bom_id)
        if not item:
            raise HTTPException(status_code=404, detail="BOM item not found")
        return self.bom.enrich_item(item)

    def get_bom_for_product(self, product_id: int) -> list[dict]:
        return [self.bom.enrich_item(item) for item in self.bom.list_by_product(product_id)]

    # ── Machines ───────────────────────────────────────────────────────────

    def list_machines(self) -> list[dict]:
        return [
            {
                "id": m.id,
                "code": m.code,
                "name": m.name,
                "status": m.status,
                "is_active": m.is_active,
                "location": getattr(m, "location", None),
            }
            for m in self.machines.list_all()
        ]

    def get_machine(self, machine_id: int) -> dict:
        m = self.machines.get_by_id(machine_id)
        if not m:
            raise HTTPException(status_code=404, detail="Machine not found")
        return {
            "id": m.id,
            "code": m.code,
            "name": m.name,
            "status": m.status,
            "is_active": m.is_active,
            "location": getattr(m, "location", None),
            "capacity": getattr(m, "capacity", None),
        }

    def get_machine_status_summary(self) -> dict:
        machines = self.machines.list_all()
        counts: dict[str, int] = {}
        for m in machines:
            counts[m.status] = counts.get(m.status, 0) + 1
        return {"total": len(machines), "by_status": counts, "machines": self.list_machines()}

    def list_running_machines(self) -> list[dict]:
        return [
            {"id": m.id, "code": m.code, "name": m.name, "status": m.status}
            for m in self.machines.list_by_status("running", "active")
        ]

    def list_idle_machines(self) -> list[dict]:
        return [
            {"id": m.id, "code": m.code, "name": m.name, "status": m.status}
            for m in self.machines.list_by_status("idle", "available")
        ]

    def list_breakdown_machines(self) -> list[dict]:
        return [
            {"id": m.id, "code": m.code, "name": m.name, "status": m.status}
            for m in self.machines.list_by_status("breakdown", "maintenance", "down")
        ]

    # ── Production Plans ───────────────────────────────────────────────────

    def list_production_plans(self) -> list[dict]:
        return _serialize_model(list_production_orders_enriched(self.db, self.tenant_id)) or []

    def list_today_plans(self) -> list[dict]:
        return [
            {
                "id": p.id,
                "order_number": p.order_number,
                "status": p.status,
                "planned_quantity": float(p.planned_quantity),
                "start_date": p.start_date.isoformat() if p.start_date else None,
            }
            for p in self.plans.list_today()
        ]

    def get_production_plan(self, plan_id: int) -> dict:
        detail = get_production_order_detail(self.db, self.tenant_id, plan_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Production plan not found")
        return _serialize_model(detail)

    # ── Work Orders ────────────────────────────────────────────────────────

    def list_work_orders(self, user: User) -> list[dict]:
        return _serialize_model(list_work_orders_enriched(self.db, self.tenant_id, user=user)) or []

    def list_today_work_orders(self, user: User) -> list[dict]:
        today_ids = {w.id for w in self.work_orders.list_today(user)}
        all_wos = list_work_orders_enriched(self.db, self.tenant_id, user=user)
        return _serialize_model([w for w in all_wos if w.id in today_ids]) or []

    def list_assigned_work_orders(self, user: User) -> list[dict]:
        assigned_ids = {w.id for w in self.work_orders.list_assigned(user)}
        all_wos = list_work_orders_enriched(self.db, self.tenant_id, user=user)
        return _serialize_model([w for w in all_wos if w.id in assigned_ids]) or []

    def get_work_order(self, work_order_id: int, user: User) -> dict:
        detail = get_work_order_detail(self.db, self.tenant_id, work_order_id, user=user)
        if not detail:
            raise HTTPException(status_code=404, detail="Work order not found or access denied")
        return _serialize_model(detail)

    def start_work_order(self, user: User, payload: WorkOrderActionRequest) -> dict:
        wo = _resolve_work_order(self.work_orders, user, payload.work_order_id, payload.work_order_number)
        result = start_work_order(self.db, self.tenant_id, wo.id)
        return _serialize_model(result)

    def pause_work_order(self, user: User, payload: WorkOrderActionRequest) -> dict:
        wo = _resolve_work_order(self.work_orders, user, payload.work_order_id, payload.work_order_number)
        result = pause_work_order(self.db, self.tenant_id, wo.id)
        return _serialize_model(result)

    def resume_work_order(self, user: User, payload: WorkOrderActionRequest) -> dict:
        wo = _resolve_work_order(self.work_orders, user, payload.work_order_id, payload.work_order_number)
        if wo.status == "paused":
            wo.status = "running"
            self.work_orders.save(wo)
        return {"success": True, "work_order_id": wo.id, "status": wo.status, "message": "Work order resumed"}

    def complete_work_order(self, user: User, payload: WorkOrderActionRequest) -> dict:
        wo = _resolve_work_order(self.work_orders, user, payload.work_order_id, payload.work_order_number)
        result = complete_work_order(self.db, self.tenant_id, wo.id)
        return _serialize_model(result)

    def update_production_progress(self, user: User, payload: WorkOrderProgressRequest) -> dict:
        wo = _resolve_work_order(self.work_orders, user, payload.work_order_id, payload.work_order_number)
        po = self._get_po(wo.production_order_id)
        product_id = po.product_id if po else 1
        report = DailyProductionReport(
            tenant_id=self.tenant_id,
            report_date=date.today(),
            product_id=product_id,
            work_order_id=wo.id,
            machine_id=wo.machine_id,
            produced_quantity=payload.produced_quantity,
            scrap_quantity=payload.scrap_quantity,
            notes=payload.notes,
            created_by_user_id=user.id,
        )
        try:
            self.db.add(report)
            wo.actual_quantity = float(wo.actual_quantity or 0) + payload.produced_quantity
            self.db.commit()
            self.db.refresh(report)
        except Exception as exc:
            logger.exception("Database error updating production progress: %s", exc)
            try:
                self.db.rollback()
            except Exception:
                pass
            raise
        return {
            "work_order_id": wo.id,
            "produced_quantity": float(wo.actual_quantity),
            "report_id": report.id,
        }

    # ── Schedule ─────────────────────────────────────────────────────────

    def get_schedule(self) -> dict:
        return _serialize_model(get_schedule_dashboard(self.db, self.tenant_id))

    def get_schedule_today(self) -> dict:
        dashboard = get_schedule_dashboard(self.db, self.tenant_id)
        timeline = get_enhanced_timeline(self.db, self.tenant_id)
        return {"dashboard": _serialize_model(dashboard), "timeline": _serialize_model(timeline)}

    def get_schedule_week(self) -> dict:
        timeline = get_enhanced_timeline(self.db, self.tenant_id)
        return {"timeline": _serialize_model(timeline), "week_start": date.today().isoformat()}

    # ── Allocation ───────────────────────────────────────────────────────

    def get_allocation(self) -> dict:
        return {
            "summary": _serialize_model(get_allocation_summary(self.db, self.tenant_id)),
            "rows": _serialize_model(get_allocation_list(self.db, self.tenant_id)),
        }

    def get_operator_allocation(self, user: User) -> dict:
        rows = get_allocation_list(self.db, self.tenant_id)
        if user_is_admin(user) or "Operator" not in set(get_role_names(user)):
            return {"rows": _serialize_model(rows)}
        filtered = [
            r for r in rows
            if r.operator_name == user.full_name
            or (user.assigned_machine_id and r.machine_id == user.assigned_machine_id)
        ]
        return {"rows": _serialize_model(filtered)}

    def get_allocation_for_machine(self, machine_id: int) -> dict:
        rows = get_allocation_list(self.db, self.tenant_id)
        filtered = [r for r in rows if r.machine_id == machine_id]
        machine = self.get_machine(machine_id)
        return {"machine": machine, "allocations": _serialize_model(filtered)}

    # ── Batches ──────────────────────────────────────────────────────────

    def list_batches(self) -> list[dict]:
        return _serialize_model(list_batches_enriched(self.db, self.tenant_id)) or []

    def get_batch(self, batch_id: int) -> dict:
        detail = get_batch_detail(self.db, self.tenant_id, batch_id)
        if not detail:
            raise HTTPException(status_code=404, detail="Batch not found")
        return _serialize_model(detail)

    def list_running_batches(self) -> list[dict]:
        batches = self.batches.list_by_status("in_process", "running")
        return [{"id": b.id, "batch_code": b.batch_code, "quantity": float(b.quantity), "status": b.status} for b in batches]

    def list_completed_batches(self) -> list[dict]:
        batches = self.batches.list_by_status("completed")
        return [{"id": b.id, "batch_code": b.batch_code, "quantity": float(b.quantity), "status": b.status} for b in batches]

    def update_batch(self, user: User, payload: BatchUpdateRequest) -> dict:
        batch = self.batches.get_by_id(payload.batch_id)
        if not batch:
            raise HTTPException(status_code=404, detail="Batch not found")
        wo = self.work_orders.get_by_id(batch.work_order_id) if batch.work_order_id else None
        if wo and not operator_can_access_work_order(user, wo):
            raise HTTPException(status_code=403, detail="Access denied to this batch")
        if payload.quantity is not None:
            batch.quantity = payload.quantity
        if payload.status:
            batch.status = payload.status
        if not batch.produced_at and payload.status in ("completed", "running"):
            batch.produced_at = datetime.now(timezone.utc)
        self.batches.save(batch)
        return {"id": batch.id, "batch_code": batch.batch_code, "quantity": float(batch.quantity), "status": batch.status}

    def report_breakdown(self, user: User, payload: MachineBreakdownRequest) -> dict:
        machine = None
        if payload.machine_id:
            machine = self.machines.get_by_id(payload.machine_id)
        elif payload.machine_code:
            machine = self.machines.get_by_code(payload.machine_code)
        if not machine:
            raise HTTPException(status_code=404, detail="Machine not found")
        machine.status = "breakdown"
        self.machines.save(machine)
        return {
            "machine_code": machine.code,
            "status": machine.status,
            "description": payload.description,
        }

    # ── Deep Intelligence Methods (for AI Chatbot) ───────────────────────────

    def get_machine_deep_status(self, query: str = "") -> list[dict]:
        """Return deep machine info: machine + active WO + product + manpower + time + efficiency."""
        from datetime import datetime, timezone
        from sqlalchemy import select
        from app.models.production import WorkOrder, ProductionOrder, DailyProductionReport
        from app.models.product import Product
        from app.models.user import User

        machines = self.machines.list_all()
        result = []
        for m in machines:
            q = query.strip().lower()
            status_aliases = {
                "running": {"running", "active", "in_progress"},
                "idle": {"idle", "available", "free"},
                "maintenance": {"maintenance", "under_maintenance"},
                "breakdown": {"breakdown", "broken", "failed", "fault"},
                "offline": {"offline", "off_line"},
            }
            requested_status = next(
                (status for status, aliases in status_aliases.items() if status in q or any(alias in q for alias in aliases)),
                None,
            )

            # get active work order on this machine
            wo = self.db.scalars(
                select(WorkOrder)
                .where(
                    WorkOrder.machine_id == m.id,
                    WorkOrder.tenant_id == self.tenant_id,
                    WorkOrder.status.in_(("running", "in_progress", "planned", "machine_ready")),
                )
                .order_by(WorkOrder.id.desc())
            ).first()

            product_name = None
            if wo:
                po = self._get_po(wo.production_order_id)
                product = self._get_product(po.product_id) if po else None
                product_name = product.name if product else None

            machine_status = (m.status or "idle").strip().lower().replace(" ", "_")
            if requested_status:
                status_matches = machine_status in status_aliases[requested_status]
                if not status_matches:
                    continue
            elif q:
                searchable = " ".join(filter(None, [
                    m.code, m.name, m.status, product_name,
                    m.department, m.location, m.machine_type,
                ])).lower()
                if q not in searchable:
                    continue

            if not wo:
                if q and not requested_status:
                    continue
                # include idle machines only if no filter
                result.append({
                    "machine_code": m.code,
                    "machine_name": m.name,
                    "machine_type": getattr(m, "machine_type", None),
                    "status": m.status,
                    "location": getattr(m, "location", None),
                    "department": getattr(m, "department", None),
                    "health_score": float(m.health_score) if m.health_score else None,
                    "efficiency_pct": float(m.efficiency_pct) if m.efficiency_pct else None,
                    "oee_pct": float(m.oee_pct) if m.oee_pct else None,
                    "temperature_c": float(m.temperature_c) if m.temperature_c else None,
                    "rpm": float(m.rpm) if m.rpm else None,
                    "last_maintenance": str(m.last_maintenance_date) if m.last_maintenance_date else None,
                    "next_maintenance": str(m.next_maintenance_date) if m.next_maintenance_date else None,
                    "current_work_order": None,
                    "product": None,
                    "manpower": None,
                })
                continue

            po = self._get_po(wo.production_order_id)
            product = self._get_product(po.product_id) if po else None
            operator = self.db.get(User, wo.assigned_user_id) if wo.assigned_user_id else None

            planned = float(wo.planned_quantity or 0)
            actual = float(wo.actual_quantity or 0)

            # sum from daily reports
            from sqlalchemy import func
            produced_sum = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0))
                .where(DailyProductionReport.work_order_id == wo.id, DailyProductionReport.tenant_id == self.tenant_id)
            ) or 0)
            if produced_sum > actual:
                actual = produced_sum

            scrap = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0))
                .where(DailyProductionReport.work_order_id == wo.id, DailyProductionReport.tenant_id == self.tenant_id)
            ) or 0)
            downtime = int(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.downtime_minutes), 0))
                .where(DailyProductionReport.work_order_id == wo.id, DailyProductionReport.tenant_id == self.tenant_id)
            ) or 0)

            remaining = max(planned - actual, 0)
            progress_pct = round(actual / planned * 100, 1) if planned else 0

            # time analysis
            now = datetime.now(timezone.utc)
            hours_remaining = None
            days_remaining = None
            is_delayed = False
            if wo.planned_end:
                end_dt = wo.planned_end.replace(tzinfo=timezone.utc) if wo.planned_end.tzinfo is None else wo.planned_end
                diff = end_dt - now
                total_secs = diff.total_seconds()
                hours_remaining = round(max(total_secs / 3600, 0), 1)
                days_remaining = round(max(total_secs / 86400, 0), 1)
                is_delayed = total_secs < 0

            good_qty = max(actual - scrap, 0)
            yield_pct = round(good_qty / actual * 100, 1) if actual else 0
            scrap_pct = round(scrap / actual * 100, 1) if actual else 0

            result.append({
                "machine_code": m.code,
                "machine_name": m.name,
                "machine_type": getattr(m, "machine_type", None),
                "status": m.status,
                "location": getattr(m, "location", None),
                "department": getattr(m, "department", None),
                "production_line": getattr(m, "production_line", None),
                "manufacturer": getattr(m, "manufacturer", None),
                "health_score": float(m.health_score) if m.health_score else None,
                "efficiency_pct": float(m.efficiency_pct) if m.efficiency_pct else 85.0,
                "oee_pct": float(m.oee_pct) if m.oee_pct else 72.0,
                "temperature_c": float(m.temperature_c) if m.temperature_c else None,
                "rpm": float(m.rpm) if m.rpm else None,
                "last_maintenance": str(m.last_maintenance_date) if m.last_maintenance_date else None,
                "next_maintenance": str(m.next_maintenance_date) if m.next_maintenance_date else None,
                "current_work_order": {
                    "work_order_number": wo.work_order_number,
                    "status": wo.status,
                    "priority": wo.priority or "medium",
                    "shift": wo.shift,
                    "department": wo.department,
                    "supervisor": wo.supervisor,
                    "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
                    "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
                    "planned_quantity": planned,
                    "produced_quantity": actual,
                    "remaining_quantity": remaining,
                    "scrap_quantity": scrap,
                    "good_quantity": good_qty,
                    "progress_pct": progress_pct,
                    "yield_pct": yield_pct,
                    "scrap_pct": scrap_pct,
                    "hours_remaining": hours_remaining,
                    "days_remaining": days_remaining,
                    "is_delayed": is_delayed,
                    "downtime_minutes": downtime,
                    "materials_issued": bool(getattr(wo, "materials_issued", False)),
                },
                "product": {
                    "name": product.name if product else None,
                    "sku": product.sku if product else None,
                    "production_order": po.order_number if po else None,
                    "customer": po.customer_name if po else None,
                    "sales_order": po.sales_order_number if po else None,
                    "bom_version": po.bom_version if po else None,
                },
                "manpower": {
                    "operator_name": wo.operator_name or (operator.full_name if operator else None),
                    "supervisor": wo.supervisor,
                    "shift": wo.shift,
                    "assigned_operator": getattr(m, "assigned_operator", None),
                    "current_shift": getattr(m, "current_shift", None),
                },
            })
        return result

    def get_work_order_deep(self, query: str = "") -> list[dict]:
        """Return all enriched work order data for AI deep answers."""
        from datetime import datetime, timezone
        from sqlalchemy import select, func
        from app.models.production import WorkOrder, ProductionOrder, DailyProductionReport
        from app.models.product import Product
        from app.models.machine import Machine
        from app.models.user import User

        wos = list(self.db.scalars(
            select(WorkOrder)
            .where(WorkOrder.tenant_id == self.tenant_id)
            .order_by(WorkOrder.id.desc())
            .limit(50)
        ).all())

        q = query.strip().lower()
        result = []
        now = datetime.now(timezone.utc)

        for wo in wos:
            po = self._get_po(wo.production_order_id)
            product = self._get_product(po.product_id) if po else None
            machine = self.db.get(Machine, wo.machine_id) if wo.machine_id else None
            operator = self.db.get(User, wo.assigned_user_id) if wo.assigned_user_id else None

            if q:
                searchable = " ".join(filter(None, [
                    wo.work_order_number, wo.status, wo.priority,
                    product.name if product else None,
                    machine.name if machine else None,
                    wo.operator_name, wo.supervisor, wo.shift, wo.department,
                    po.customer_name if po else None,
                ])).lower()
                if q not in searchable:
                    continue

            planned = float(wo.planned_quantity or 0)
            actual = float(wo.actual_quantity or 0)
            scrap = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0))
                .where(DailyProductionReport.work_order_id == wo.id, DailyProductionReport.tenant_id == self.tenant_id)
            ) or 0)
            downtime = int(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.downtime_minutes), 0))
                .where(DailyProductionReport.work_order_id == wo.id, DailyProductionReport.tenant_id == self.tenant_id)
            ) or 0)

            remaining = max(planned - actual, 0)
            progress_pct = round(actual / planned * 100, 1) if planned else 0
            scrap_pct = round(scrap / actual * 100, 1) if actual else 0
            good_qty = max(actual - scrap, 0)

            hours_remaining = days_remaining = None
            is_delayed = False
            if wo.planned_end:
                end_dt = wo.planned_end.replace(tzinfo=timezone.utc) if wo.planned_end.tzinfo is None else wo.planned_end
                diff = end_dt - now
                hours_remaining = round(max(diff.total_seconds() / 3600, 0), 1)
                days_remaining = round(max(diff.total_seconds() / 86400, 0), 1)
                is_delayed = diff.total_seconds() < 0

            result.append({
                "work_order_number": wo.work_order_number,
                "status": wo.status,
                "priority": wo.priority or "medium",
                "shift": wo.shift,
                "department": wo.department,
                "supervisor": wo.supervisor,
                "operator_name": wo.operator_name or (operator.full_name if operator else None),
                "planned_start": wo.planned_start.isoformat() if wo.planned_start else None,
                "planned_end": wo.planned_end.isoformat() if wo.planned_end else None,
                "planned_quantity": planned,
                "produced_quantity": actual,
                "remaining_quantity": remaining,
                "scrap_quantity": scrap,
                "good_quantity": good_qty,
                "progress_pct": progress_pct,
                "scrap_pct": scrap_pct,
                "downtime_minutes": downtime,
                "hours_remaining": hours_remaining,
                "days_remaining": days_remaining,
                "is_delayed": is_delayed,
                "materials_issued": bool(getattr(wo, "materials_issued", False)),
                "product": {
                    "name": product.name if product else None,
                    "sku": product.sku if product else None,
                    "customer": po.customer_name if po else None,
                    "production_order": po.order_number if po else None,
                    "sales_order": po.sales_order_number if po else None,
                    "bom_version": po.bom_version if po else None,
                },
                "machine": {
                    "id": machine.id if machine else None,
                    "code": machine.code if machine else None,
                    "name": machine.name if machine else None,
                    "status": machine.status if machine else None,
                    "oee_pct": float(machine.oee_pct) if machine and machine.oee_pct else None,
                    "efficiency_pct": float(machine.efficiency_pct) if machine and machine.efficiency_pct else None,
                },
            })
        return result

    def get_batch_deep(self, query: str = "") -> list[dict]:
        """Return enriched batch data for AI deep answers."""
        from sqlalchemy import select
        from app.models.production import Batch, WorkOrder, ProductionOrder
        from app.models.product import Product
        from app.models.machine import Machine
        from app.models.user import User

        batches = list(self.db.scalars(
            select(Batch).where(Batch.tenant_id == self.tenant_id).order_by(Batch.id.desc()).limit(30)
        ).all())

        q = query.strip().lower()
        result = []
        for b in batches:
            wo = self.db.get(WorkOrder, b.work_order_id)
            po = self._get_po(wo.production_order_id) if wo else None
            product = self._get_product(po.product_id) if po else None
            machine = self.db.get(Machine, wo.machine_id) if wo and wo.machine_id else None
            operator = self.db.get(User, wo.assigned_user_id) if wo and wo.assigned_user_id else None

            if q:
                searchable = " ".join(filter(None, [
                    b.batch_code, b.status,
                    product.name if product else None,
                    machine.name if machine else None,
                    operator.full_name if operator else None,
                    wo.operator_name if wo else None,
                    po.customer_name if po else None,
                ])).lower()
                if q not in searchable:
                    continue

            qty = float(b.quantity or 0)
            from app.models.production import DailyProductionReport
            scrap_from_report = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                    DailyProductionReport.tenant_id == self.tenant_id,
                    DailyProductionReport.work_order_id == b.work_order_id,
                )
            ) or 0) if b.work_order_id else 0.0

            raw_scrap = getattr(b, "scrap_quantity", None) or getattr(b, "scrap_qty", None) or scrap_from_report or (getattr(wo, "scrap_quantity", None) if wo else None)
            scrap = round(float(raw_scrap or 0.0), 2)
            raw_good = getattr(b, "good_quantity", None) or getattr(b, "good_qty", None)
            good = round(float(raw_good), 2) if raw_good is not None else round(max(0.0, qty - scrap), 2)
            yield_pct = round(good / qty * 100, 1) if qty else 0.0

            mat_lot = (
                getattr(b, "material_lot", None)
                or getattr(b, "raw_material_lot", None)
                or getattr(b, "lot_number", None)
                or (getattr(wo, "material_lot", None) if wo else None)
            )
            if not mat_lot and b.batch_code:
                from app.models.inventory import StockMovement
                sm = self.db.scalars(
                    select(StockMovement).where(
                        StockMovement.tenant_id == self.tenant_id,
                        StockMovement.batch_number == b.batch_code,
                    )
                ).first()
                if sm:
                    mat_lot = sm.reference or sm.batch_number

            from app.models.quality import QualityInspection
            qi_rec = self.db.scalars(
                select(QualityInspection).where(
                    QualityInspection.tenant_id == self.tenant_id,
                    (QualityInspection.batch_id == b.id) | (QualityInspection.batch_code == b.batch_code),
                ).order_by(QualityInspection.id.desc())
            ).first()

            if qi_rec:
                res = (qi_rec.result or qi_rec.status or "").lower()
                if res in ("pass", "passed", "approved"):
                    qc_status = "passed"
                elif res in ("fail", "failed", "rejected"):
                    qc_status = "failed"
                elif res:
                    qc_status = res
                else:
                    qc_status = "pending"
            else:
                raw_qc = getattr(b, "qc_status", None)
                qc_status = raw_qc if raw_qc else ("passed" if b.status in ("completed", "closed", "approved") else "pending")

            from app.models.sales import SalesOrder
            dispatch_sm = self.db.scalars(
                select(StockMovement).where(
                    StockMovement.tenant_id == self.tenant_id,
                    StockMovement.batch_number == b.batch_code,
                    StockMovement.movement_type.in_(("out", "sales", "dispatch", "shipment")),
                )
            ).first()

            so = None
            if po and getattr(po, "sales_order_id", None):
                so = self.db.get(SalesOrder, po.sales_order_id)

            if dispatch_sm or (so and getattr(so, "shipped", False)) or getattr(b, "dispatched", False):
                dispatch_status = "dispatched"
            elif so and getattr(so, "status", None):
                dispatch_status = so.status
            elif getattr(b, "dispatch_status", None):
                dispatch_status = getattr(b, "dispatch_status")
            else:
                dispatch_status = "pending"

            result.append({
                "batch_code": b.batch_code,
                "status": b.status,
                "quantity": qty,
                "good_quantity": good,
                "scrap_quantity": scrap,
                "yield_pct": yield_pct,
                "produced_at": b.produced_at.isoformat() if b.produced_at else None,
                "qc_status": qc_status,
                "dispatch_status": dispatch_status,
                "material_lot": mat_lot,
                "product": {
                    "name": product.name if product else None,
                    "sku": product.sku if product else None,
                    "customer": po.customer_name if po else None,
                    "production_order": po.order_number if po else None,
                    "bom_version": po.bom_version if po else None,
                },
                "work_order": wo.work_order_number if wo else None,
                "machine": machine.name if machine else None,
                "machine_code": machine.code if machine else None,
                "operator": wo.operator_name if wo else (operator.full_name if operator else None),
                "shift": wo.shift if wo else None,
                "supervisor": wo.supervisor if wo else None,
                "traceability": [
                    "Raw Material → Received",
                    "BOM → Released",
                    f"Production → {'Completed' if b.status == 'completed' else 'In Progress'} on {machine.name if machine else '—'}",
                    f"QC → {'Passed' if b.status == 'completed' else 'Pending'}",
                    "Packing → Pending",
                    "Dispatch → Pending",
                ],
            })
        return result

    def get_product_detail_deep(self, product_name: str = "") -> dict:
        """Return full product details: BOM raw materials, machines, time estimate, manpower."""
        from sqlalchemy import select, func
        from app.models.production import WorkOrder, ProductionOrder, DailyProductionReport
        from app.models.machine import Machine
        from app.models.user import User as UserModel

        q = product_name.strip().lower()

        # Find matching products
        products_found = self.products.search(q) if q else self.products.list_all()[:10]
        if not products_found:
            return {"found": False, "product_name": product_name, "message": f"No product found matching '{product_name}'."}

        results = []
        for product in products_found[:3]:  # limit to 3 matches
            # BOM — raw materials
            bom_items = [self.bom.enrich_item(b) for b in self.bom.list_by_product(product.id)]
            total_bom_cost = round(sum(b.get("total_cost", 0) for b in bom_items), 2)

            # Latest production order for this product
            latest_po = self.db.scalars(
                select(ProductionOrder)
                .where(
                    ProductionOrder.tenant_id == self.tenant_id,
                    ProductionOrder.product_id == product.id,
                )
                .order_by(ProductionOrder.id.desc())
            ).first()

            # Latest work order for this product (via production order)
            latest_wo = None
            machine = None
            operator = None
            if latest_po:
                latest_wo = self.db.scalars(
                    select(WorkOrder)
                    .where(
                        WorkOrder.production_order_id == latest_po.id,
                        WorkOrder.tenant_id == self.tenant_id,
                    )
                    .order_by(WorkOrder.id.desc())
                ).first()
                if latest_wo:
                    if latest_wo.machine_id:
                        machine = self.db.get(Machine, latest_wo.machine_id)
                    if latest_wo.assigned_user_id:
                        operator = self.db.get(UserModel, latest_wo.assigned_user_id)

            # Time estimate from work order dates
            time_estimate_hours = None
            time_estimate_days = None
            time_start = latest_wo.planned_start if latest_wo else None
            time_end = latest_wo.planned_end if latest_wo else None
            if not time_start and latest_po:
                time_start = latest_po.start_date
            if not time_end and latest_po:
                time_end = latest_po.due_date
            if time_start and time_end:
                delta = time_end - time_start
                time_estimate_hours = round(delta.total_seconds() / 3600, 1)
                time_estimate_days = round(delta.total_seconds() / 86400, 1)

            # Actual avg cycle time from daily reports
            avg_cycle = None
            if latest_wo:
                report_count = self.db.scalar(
                    select(func.count(DailyProductionReport.id))
                    .where(DailyProductionReport.work_order_id == latest_wo.id,
                           DailyProductionReport.tenant_id == self.tenant_id)
                ) or 0
                if report_count > 0:
                    total_produced = float(self.db.scalar(
                        select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0))
                        .where(DailyProductionReport.work_order_id == latest_wo.id,
                               DailyProductionReport.tenant_id == self.tenant_id)
                    ) or 0)
                    if total_produced > 0 and time_estimate_hours:
                        avg_cycle = round(time_estimate_hours / total_produced * 60, 2)  # min/unit

            # Manpower from work order
            manpower = {"operator_name": None, "supervisor": None, "shift": None, "department": None}
            if latest_wo:
                manpower = {
                    "operator_name": latest_wo.operator_name or (operator.full_name if operator else None),
                    "supervisor": latest_wo.supervisor,
                    "shift": latest_wo.shift,
                    "department": latest_wo.department,
                }

            results.append({
                "product_id": product.id,
                "product_name": product.name,
                "sku": product.sku,
                "description": product.description,
                "unit_cost": float(product.unit_cost) if product.unit_cost else None,
                "unit_price": float(product.unit_price) if product.unit_price else None,
                "raw_materials": bom_items,
                "total_raw_material_cost": total_bom_cost,
                "machine": {
                    "code": machine.code if machine else None,
                    "name": machine.name if machine else None,
                    "type": getattr(machine, "machine_type", None) if machine else None,
                    "status": machine.status if machine else None,
                    "location": getattr(machine, "location", None) if machine else None,
                    "department": getattr(machine, "department", None) if machine else None,
                    "oee_pct": float(machine.oee_pct) if machine and machine.oee_pct else None,
                    "efficiency_pct": float(machine.efficiency_pct) if machine and machine.efficiency_pct else None,
                } if machine else None,
                "time_estimate": {
                    "planned_hours": time_estimate_hours,
                    "planned_days": time_estimate_days,
                    "avg_cycle_time_min_per_unit": avg_cycle,
                    "planned_start": time_start.isoformat() if time_start else None,
                    "planned_end": time_end.isoformat() if time_end else None,
                },
                "manpower": manpower,
                "latest_production_order": {
                    "order_number": latest_po.order_number if latest_po else None,
                    "status": latest_po.status if latest_po else None,
                    "planned_quantity": float(latest_po.planned_quantity) if latest_po else None,
                    "customer": latest_po.customer_name if latest_po else None,
                    "due_date": latest_po.due_date.isoformat() if latest_po and latest_po.due_date else None,
                    "priority": latest_po.priority if latest_po else None,
                } if latest_po else None,
                "latest_work_order": latest_wo.work_order_number if latest_wo else None,
            })

        return {"found": True, "query": product_name, "count": len(results), "products": results}

    def get_production_plan_deep(self, query: str = "") -> list[dict]:
        """Return enriched production plan data for AI deep answers."""
        from datetime import datetime, timezone
        from sqlalchemy import select
        from app.models.production import ProductionOrder, WorkOrder
        from app.models.product import Product
        from app.models.machine import Machine

        plans = list(self.db.scalars(
            select(ProductionOrder).where(ProductionOrder.tenant_id == self.tenant_id)
            .order_by(ProductionOrder.id.desc()).limit(20)
        ).all())

        q = query.strip().lower()
        result = []
        now = datetime.now(timezone.utc)

        for po in plans:
            product = self.db.get(Product, po.product_id)
            machine = self.db.get(Machine, po.machine_id) if po.machine_id else None

            if q:
                searchable = " ".join(filter(None, [
                    po.order_number, po.status, po.priority,
                    product.name if product else None,
                    po.customer_name, po.department, po.shift,
                ])).lower()
                if q not in searchable:
                    continue

            wos = list(self.db.scalars(
                select(WorkOrder).where(
                    WorkOrder.production_order_id == po.id,
                    WorkOrder.tenant_id == self.tenant_id,
                )
            ).all())

            completed_wos = sum(1 for w in wos if w.status in ("completed", "done", "closed"))
            running_wos = sum(1 for w in wos if w.status in ("running", "in_progress"))
            total_actual = sum(float(w.actual_quantity or 0) for w in wos)

            planned = float(po.planned_quantity or 0)
            progress_pct = round(total_actual / planned * 100, 1) if planned else 0

            hours_remaining = days_remaining = None
            is_delayed = False
            if po.due_date:
                due = po.due_date.replace(tzinfo=timezone.utc) if po.due_date.tzinfo is None else po.due_date
                diff = due - now
                hours_remaining = round(max(diff.total_seconds() / 3600, 0), 1)
                days_remaining = round(max(diff.total_seconds() / 86400, 0), 1)
                is_delayed = diff.total_seconds() < 0

            result.append({
                "order_number": po.order_number,
                "status": po.status,
                "priority": po.priority,
                "planned_quantity": planned,
                "produced_quantity": total_actual,
                "remaining_quantity": max(planned - total_actual, 0),
                "progress_pct": progress_pct,
                "start_date": po.start_date.isoformat() if po.start_date else None,
                "due_date": po.due_date.isoformat() if po.due_date else None,
                "hours_remaining": hours_remaining,
                "days_remaining": days_remaining,
                "is_delayed": is_delayed,
                "department": po.department,
                "shift": po.shift,
                "customer": po.customer_name,
                "sales_order": po.sales_order_number,
                "bom_version": po.bom_version,
                "product": {
                    "name": product.name if product else None,
                    "sku": product.sku if product else None,
                },
                "machine": {
                    "name": machine.name if machine else None,
                    "code": machine.code if machine else None,
                    "status": machine.status if machine else None,
                },
                "work_orders": {
                    "total": len(wos),
                    "running": running_wos,
                    "completed": completed_wos,
                    "pending": len(wos) - completed_wos - running_wos,
                },
            })
        return result

    def get_shopfloor_deep(self) -> dict:
        """Return complete shop floor snapshot for AI deep answers."""
        from datetime import date
        from sqlalchemy import func, select
        from app.models.production import WorkOrder, ProductionOrder, DailyProductionReport
        from app.models.product import Product
        from app.models.machine import Machine
        from app.models.user import User

        today = date.today()
        machines = list(self.db.scalars(select(Machine).where(Machine.tenant_id == self.tenant_id)).all())
        running = [m for m in machines if m.status in ("running", "active")]
        idle = [m for m in machines if m.status in ("idle", "available")]
        breakdown = [m for m in machines if m.status in ("breakdown", "down", "maintenance")]

        wos = list(self.db.scalars(
            select(WorkOrder).where(
                WorkOrder.tenant_id == self.tenant_id,
                WorkOrder.status.in_(("running", "in_progress")),
            )
        ).all())

        operators_count = int(self.db.scalar(
            select(func.count(func.distinct(WorkOrder.assigned_user_id))).where(
                WorkOrder.tenant_id == self.tenant_id,
                WorkOrder.status.in_(("running", "in_progress")),
                WorkOrder.assigned_user_id.isnot(None),
            )
        ) or 0)

        reports_today = list(self.db.scalars(
            select(DailyProductionReport).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )
        ).all())

        todays_production = int(sum(float(r.produced_quantity or 0) for r in reports_today))
        todays_scrap = int(sum(float(r.scrap_quantity or 0) for r in reports_today))
        todays_downtime = int(sum(r.downtime_minutes or 0 for r in reports_today))

        running_jobs_detail = []
        for wo in wos[:10]:
            po = self._get_po(wo.production_order_id)
            product = self._get_product(po.product_id) if po else None
            machine = self.db.get(Machine, wo.machine_id) if wo.machine_id else None
            operator = self.db.get(User, wo.assigned_user_id) if wo.assigned_user_id else None
            planned = float(wo.planned_quantity or 0)
            actual = float(wo.actual_quantity or 0)
            running_jobs_detail.append({
                "work_order": wo.work_order_number,
                "product": product.name if product else "—",
                "machine": f"{machine.code} {machine.name}" if machine else "—",
                "operator": wo.operator_name or (operator.full_name if operator else "—"),
                "shift": wo.shift or "—",
                "progress_pct": round(actual / planned * 100, 1) if planned else 0,
                "produced": actual,
                "planned": planned,
            })

        availability = (len(running) / len(machines)) if machines else 0.0
        total_planned_wo = sum(float(w.planned_quantity or 0) for w in wos)
        total_actual_wo = sum(float(w.actual_quantity or 0) for w in wos)
        performance = min(total_actual_wo / total_planned_wo, 1.0) if total_planned_wo > 0 else 1.0
        good_output = max(todays_production - todays_scrap, 0)
        quality = (good_output / todays_production) if todays_production > 0 else 1.0

        oee = round(min(max(availability * performance * quality * 100.0, 0.0), 100.0), 1) if machines else 0.0

        floor_alerts = [f"{m.code} — {m.name}: BREAKDOWN" for m in breakdown]
        shortage_wos = [
            w for w in wos
            if w.status not in ("completed", "closed", "cancelled", "material_ready")
            and not getattr(w, "materials_issued", False)
        ]
        if shortage_wos:
            floor_alerts.append(f"Material shortage for {len(shortage_wos)} active work order(s)")

        return {
            "date": today.isoformat(),
            "machines": {
                "total": len(machines),
                "running": len(running),
                "idle": len(idle),
                "breakdown": len(breakdown),
                "utilization_pct": oee,
            },
            "production": {
                "todays_output": todays_production,
                "todays_scrap": todays_scrap,
                "todays_downtime_minutes": todays_downtime,
                "running_jobs": len(wos),
                "operators_working": operators_count,
            },
            "running_jobs_detail": running_jobs_detail,
            "alerts": floor_alerts,
        }

    def _resolve_hr_employee(self, user: User):
        return None

    def _resolve_attendance_employee_id(self, user: User) -> int:
        employee = self._resolve_hr_employee(user)
        if employee is not None:
            return employee.id

        if user.employee_id and user.employee_id.isdigit():
            return int(user.employee_id)

        return user.id

    def get_attendance(self, user: User) -> dict:
        employee_id = self._resolve_attendance_employee_id(user)
        return {
            "employee_id": employee_id,
            "present": 0,
            "absent": 0,
            "on_duty": 0,
            "late_or_ot": 0,
            "records": [],
            "message": "Attendance tracking is not enabled.",
        }

    def clock_in(self, user: User):
        raise HTTPException(status_code=404, detail="Attendance tracking is not enabled")

    def clock_out(self, user: User):
        raise HTTPException(status_code=404, detail="Attendance tracking is not enabled")

    def get_attendance_deep(self, user) -> dict:
        """Return attendance placeholder for AI answers (module removed)."""
        employee = self._resolve_hr_employee(user)
        return {
            "operator_name": user.full_name,
            "employee_id": employee.id if employee else user.id,
            "matched_employee_name": employee.full_name if employee else None,
            "matched_employee_code": employee.employee_code if employee else None,
            "today": {
                "status": "Not available",
                "clock_in": None,
                "clock_out": None,
                "hours_worked": 0,
            },
            "attendance_records": [],
            "last_30_days": {
                "present": 0,
                "absent": 0,
                "late": 0,
                "total_hours_worked": 0,
                "attendance_pct": 0,
            },
            "assigned_machine": user.assigned_machine_id,
            "plant_code": user.plant_code,
            "message": "Attendance tracking is not enabled.",
        }

    # ── Notifications ────────────────────────────────────────────────────

    def get_notifications(self, user: User) -> dict:
        return NotificationManagementService(self.db, user).list_notifications()

    def mark_notifications_read(self, user: User, notification_ids: list[str] | None) -> dict:
        return mark_notifications_read(self.db, user, notification_ids)

    def clear_notifications(self, user: User) -> dict:
        return clear_all_notifications(self.db, user)

    # ── Profile ────────────────────────────────────────────────────────────

    def get_profile(self, user: User) -> OperatorProfileRead:
        return OperatorProfileRead(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            tenant_id=user.tenant_id,
            roles=get_role_names(user),
            assigned_machine_id=user.assigned_machine_id,
            plant_code=user.plant_code,
        )

    # ── Notifications ────────────────────────────────────────────────────

    # ── Extra Deep Intelligence Methods ──────────────────────────────────────

    def get_production_overview_deep(self, query: str = "") -> dict:
        """Return order counts/details, optionally filtered by requested order status."""
        from sqlalchemy import select, func
        from app.models.production import ProductionOrder, DailyProductionReport
        from app.models.product import Product
        from app.models.machine import Machine
        from app.models.user import User
        from app.services.manufacturing_workflow_service import get_bom_requirements
        from datetime import datetime, timezone

        orders = list(self.db.scalars(
            select(ProductionOrder).where(ProductionOrder.tenant_id == self.tenant_id)
        ).all())

        PLANNED = {"draft", "planned", "pending", "material_ready", "machine_assigned"}
        IN_PROG = {"in_progress", "running", "quality_check"}
        DONE    = {"completed", "closed", "done"}
        now = datetime.now(timezone.utc)
        query_text = (query or "").lower()
        status_filter = None
        if any(word in query_text for word in ("completed", "finished", "closed", "done")):
            status_filter = DONE
        elif any(word in query_text for word in ("in progress", "running", "active")):
            status_filter = IN_PROG
        elif any(word in query_text for word in ("planned", "scheduled", "pending", "open")):
            status_filter = PLANNED
        elif "cancelled" in query_text or "canceled" in query_text:
            status_filter = {"cancelled"}
        report_orders = [o for o in orders if status_filter is None or o.status in status_filter]

        def is_del(o):
            if o.status in DONE or o.status == "cancelled": return False
            if not o.due_date: return False
            due = o.due_date if o.due_date.tzinfo else o.due_date.replace(tzinfo=timezone.utc)
            return due < now

        today = date.today()
        todays_output = float(self.db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )) or 0)
        todays_scrap = float(self.db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )) or 0)

        order_details = []
        for o in report_orders:
            product = self.db.get(Product, o.product_id)
            work_orders = list(self.db.scalars(
                select(WorkOrder).where(WorkOrder.production_order_id == o.id,
                                        WorkOrder.tenant_id == self.tenant_id)
                .order_by(WorkOrder.id.desc())
            ).all())
            planned  = float(o.planned_quantity or 0)
            produced = sum(float(wo.actual_quantity or 0) for wo in work_orders)
            raw_materials = []
            bom_available = True
            bom_error = None
            try:
                raw_materials = get_bom_requirements(
                    self.db, self.tenant_id, o.product_id, planned
                )
            except Exception as exc:
                logger.exception("Could not load BOM for production order %s", o.id)
                bom_available = False
                bom_error = "BOM information unavailable"

            work_order_details = []
            manpower = set()
            for wo in work_orders:
                machine = self.db.get(Machine, wo.machine_id) if wo.machine_id else None
                operator = self.db.get(User, wo.assigned_user_id) if wo.assigned_user_id else None
                operator_name = wo.operator_name or (operator.full_name if operator else None)
                if operator_name:
                    manpower.add(operator_name)
                if wo.supervisor:
                    manpower.add(wo.supervisor)

                start = wo.planned_start
                end = wo.planned_end
                end_for_duration = end
                if start and not end_for_duration and wo.status in IN_PROG:
                    end_for_duration = now
                elapsed_hours = None
                planned_hours = None
                if start and end_for_duration:
                    start_dt = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
                    end_dt = end_for_duration if end_for_duration.tzinfo else end_for_duration.replace(tzinfo=timezone.utc)
                    elapsed_hours = round(max((end_dt - start_dt).total_seconds() / 3600, 0), 2)
                if start and end:
                    start_dt = start if start.tzinfo else start.replace(tzinfo=timezone.utc)
                    end_dt = end if end.tzinfo else end.replace(tzinfo=timezone.utc)
                    planned_hours = round(max((end_dt - start_dt).total_seconds() / 3600, 0), 2)

                work_order_details.append({
                    "work_order_id": wo.id,
                    "work_order_number": wo.work_order_number,
                    "status": wo.status,
                    "machine_id": wo.machine_id,
                    "machine_code": machine.code if machine else None,
                    "machine_name": machine.name if machine else None,
                    "operator": operator_name,
                    "supervisor": wo.supervisor,
                    "shift": wo.shift,
                    "department": wo.department,
                    "planned_quantity": float(wo.planned_quantity or 0),
                    "produced_quantity": float(wo.actual_quantity or 0),
                    "planned_start": start.isoformat() if start else None,
                    "planned_end": end.isoformat() if end else None,
                    "planned_hours": planned_hours,
                    "time_taken_hours": elapsed_hours,
                    "materials_issued": bool(wo.materials_issued),
                })

            order_details.append({
                "production_order_id": o.id,
                "order_number": o.order_number,
                "product_id": o.product_id,
                "product": product.name if product else "—",
                "product_sku": product.sku if product else None,
                "customer": o.customer_name or "—",
                "status": o.status,
                "priority": o.priority or "medium",
                "planned_qty": planned,
                "produced_qty": produced,
                "progress_pct": round(produced / planned * 100, 1) if planned else 0.0,
                "due_date": str(o.due_date)[:10] if o.due_date else "—",
                "is_delayed": is_del(o),
                "machine_ids": sorted({wo["machine_id"] for wo in work_order_details if wo["machine_id"]}),
                "manpower_count": len(manpower),
                "manpower": sorted(manpower),
                "work_orders": work_order_details,
                "raw_materials": raw_materials,
                "bom_available": bom_available,
                "bom_status": "available" if bom_available else "unavailable",
                "bom_error": bom_error,
            })

        return {
            "summary": {
                "total_orders": len(report_orders),
                "planned": sum(1 for o in report_orders if o.status in PLANNED),
                "in_progress": sum(1 for o in report_orders if o.status in IN_PROG),
                "completed": sum(1 for o in report_orders if o.status in DONE),
                "pending": sum(1 for o in report_orders if o.status in PLANNED),
                "delayed": sum(1 for o in report_orders if is_del(o)),
                "cancelled": sum(1 for o in report_orders if o.status == "cancelled"),
            },
            "today": {"output": todays_output, "scrap": todays_scrap, "date": str(today)},
            "orders": order_details,
            "active_orders": [o for o in order_details if o["status"] in IN_PROG],
        }

    def get_schedule_deep(self, query: str = "") -> list[dict]:
        """Full production schedule: machine, product, operator, shift, timeline, progress."""
        from sqlalchemy import select
        from app.models.production import WorkOrder as WO2, ProductionOrder
        from app.models.product import Product
        from app.models.user import User as UserModel
        from datetime import datetime, timezone

        wos = list(self.db.scalars(
            select(WO2).where(WO2.tenant_id == self.tenant_id, WO2.status.notin_(("cancelled",)))
            .order_by(WO2.planned_start.asc().nullslast())
        ).all())

        q = query.strip().lower()
        now = datetime.now(timezone.utc)
        result = []

        for wo in wos:
            po = self.db.get(ProductionOrder, wo.production_order_id) if wo.production_order_id else None
            product = self.db.get(Product, po.product_id) if po else None
            machine = self.machines.get_by_id(wo.machine_id) if wo.machine_id else None
            operator = self.db.get(UserModel, wo.assigned_user_id) if wo.assigned_user_id else None
            prod_name = product.name if product else "—"
            op_name = (getattr(operator, "full_name", None) or getattr(operator, "email", "—")) if operator else "Unassigned"
            mc_code = machine.code if machine else "—"

            if q and q not in " ".join(filter(None, [wo.work_order_number, prod_name, mc_code, op_name, wo.status, wo.shift])).lower():
                continue

            pe = wo.planned_end
            hrs = days = None
            delayed = False
            if pe:
                pe_tz = pe if pe.tzinfo else pe.replace(tzinfo=timezone.utc)
                secs = (pe_tz - now).total_seconds()
                hrs = round(secs / 3600, 1)
                days = round(secs / 86400, 1)
                delayed = pe_tz < now and wo.status not in ("completed", "closed", "done")

            planned = float(wo.planned_quantity or 0)
            produced = float(wo.actual_quantity or 0)
            result.append({
                "work_order_number": wo.work_order_number, "status": wo.status,
                "priority": wo.priority or "medium", "product": prod_name,
                "customer": po.customer_name if po else "—",
                "production_order": po.order_number if po else "—",
                "machine_code": mc_code, "machine_name": machine.name if machine else "—",
                "operator": op_name, "shift": wo.shift or "—", "department": wo.department or "—",
                "planned_start": str(wo.planned_start)[:16] if wo.planned_start else "—",
                "planned_end": str(pe)[:16] if pe else "—",
                "hours_remaining": hrs, "days_remaining": days, "is_delayed": delayed,
                "planned_quantity": planned, "produced_quantity": produced,
                "progress_pct": round(produced / planned * 100, 1) if planned else 0.0,
            })
        return result[:20]

    def get_mrp_deep(self, query: str = "") -> list[dict]:
        """MRP: material status per production order — required, available, shortage per BOM component."""
        from sqlalchemy import select
        from app.models.production import ProductionOrder
        from app.models.product import Product
        from app.services.manufacturing_workflow_service import get_bom_requirements

        orders = list(self.db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == self.tenant_id,
                ProductionOrder.status.notin_(("cancelled", "completed", "closed", "done")),
            ).order_by(ProductionOrder.id.desc())
        ).all())

        q = query.strip().lower()
        result = []

        for order in orders[:15]:
            product = self.db.get(Product, order.product_id)
            prod_name = product.name if product else "—"
            if q and q not in " ".join(filter(None, [order.order_number, prod_name, order.status, order.customer_name])).lower():
                continue
            bom_error = False
            try:
                reqs = get_bom_requirements(self.db, self.tenant_id, order.product_id, float(order.planned_quantity or 0))
            except Exception as exc:
                logger.exception("Failed to calculate BOM requirements for order %s: %s", order.order_number, exc)
                reqs = []
                bom_error = True

            if bom_error:
                material_status = "BOM Calculation Error"
                all_ok = False
            else:
                shortages = [r for r in reqs if not r.get("enough", True)]
                material_status = "All Available" if not shortages else f"{len(shortages)} Shortage(s)"
                all_ok = len(shortages) == 0

            issued = any(getattr(wo, "materials_issued", False)
                         for wo in self.db.scalars(select(WorkOrder).where(WorkOrder.tenant_id == self.tenant_id, WorkOrder.production_order_id == order.id)).all())
            result.append({
                "order_number": order.order_number, "product": prod_name,
                "customer": order.customer_name or "—", "status": order.status,
                "priority": order.priority or "medium",
                "planned_quantity": float(order.planned_quantity or 0),
                "due_date": str(order.due_date)[:10] if order.due_date else "—",
                "materials_issued": issued,
                "material_status": material_status,
                "all_ok": all_ok,
                "total_components": len(reqs),
                "components": [{
                    "name": r["component_name"], "sku": r.get("sku", "—"),
                    "required": r["required_qty"], "available": r["available_qty"],
                    "shortage": r["shortage_qty"], "unit": r.get("unit", ""),
                    "ok": r.get("enough", True),
                } for r in reqs],
            })
        return result

    def get_assigned_tasks_deep(self, query: str = "", user: User = None) -> list[dict]:
        """All work orders assigned to operators with full details."""
        from sqlalchemy import select
        from app.models.production import WorkOrder as WO3, ProductionOrder
        from app.models.product import Product
        from app.models.user import User as UserModel
        from datetime import datetime, timezone

        wos = list(self.db.scalars(
            select(WO3).where(WO3.tenant_id == self.tenant_id, WO3.status.notin_(("cancelled",)))
            .order_by(WO3.id.desc())
        ).all())

        if user and not user_is_admin(user):
            wos = [wo for wo in wos if wo.assigned_user_id == user.id]

        q = query.strip().lower()
        now = datetime.now(timezone.utc)
        result = []

        for wo in wos[:25]:
            po = self.db.get(ProductionOrder, wo.production_order_id) if wo.production_order_id else None
            product = self.db.get(Product, po.product_id) if po else None
            machine = self.machines.get_by_id(wo.machine_id) if wo.machine_id else None
            operator = self.db.get(UserModel, wo.assigned_user_id) if wo.assigned_user_id else None
            prod_name = product.name if product else "—"
            op_name = (getattr(operator, "full_name", None) or getattr(operator, "email", "—")) if operator else "Unassigned"
            mc_code = machine.code if machine else "—"
            if q and q not in " ".join(filter(None, [wo.work_order_number, prod_name, op_name, mc_code, wo.status, wo.shift])).lower():
                continue
            pe = wo.planned_end
            hrs = days = None
            delayed = False
            if pe:
                pe_tz = pe if pe.tzinfo else pe.replace(tzinfo=timezone.utc)
                secs = (pe_tz - now).total_seconds()
                hrs = round(secs / 3600, 1)
                days = round(secs / 86400, 1)
                delayed = pe_tz < now and wo.status not in ("completed", "closed", "done")
            planned = float(wo.planned_quantity or 0)
            produced = float(wo.actual_quantity or 0)
            result.append({
                "work_order_number": wo.work_order_number, "status": wo.status,
                "priority": wo.priority or "medium", "product": prod_name,
                "customer": po.customer_name if po else "—",
                "production_order": po.order_number if po else "—",
                "assigned_operator": op_name, "machine_code": mc_code,
                "machine_name": machine.name if machine else "—",
                "shift": wo.shift or "—", "department": wo.department or "—",
                "planned_quantity": planned, "produced_quantity": produced,
                "remaining_quantity": max(planned - produced, 0),
                "progress_pct": round(produced / planned * 100, 1) if planned else 0.0,
                "planned_start": str(wo.planned_start)[:16] if wo.planned_start else "—",
                "planned_end": str(pe)[:16] if pe else "—",
                "hours_remaining": hrs, "days_remaining": days, "is_delayed": delayed,
                "materials_issued": getattr(wo, "materials_issued", False),
            })
        return result

    def get_product_overview_deep(self) -> dict:
        """Products overview: total, today's produced products, order status breakdown."""
        from sqlalchemy import select, func
        from app.models.production import ProductionOrder, DailyProductionReport, WorkOrder
        from app.models.product import Product
        from datetime import datetime, timezone

        products = list(self.db.scalars(
            select(Product).where(Product.tenant_id == self.tenant_id)
        ).all())
        orders = list(self.db.scalars(
            select(ProductionOrder).where(ProductionOrder.tenant_id == self.tenant_id)
        ).all())

        PLANNED = {"draft", "planned", "pending", "material_ready", "machine_assigned"}
        IN_PROG = {"in_progress", "running", "quality_check"}
        DONE    = {"completed", "closed", "done"}
        now = datetime.now(timezone.utc)

        def is_del(o):
            if o.status in DONE or o.status == "cancelled": return False
            if not o.due_date: return False
            due = o.due_date if o.due_date.tzinfo else o.due_date.replace(tzinfo=timezone.utc)
            return due < now

        today = date.today()
        today_report_product_ids = list(self.db.scalars(
            select(DailyProductionReport.product_id).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            ).distinct()
        ).all())

        today_output = float(self.db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )) or 0)

        # per-product stats
        product_stats = []
        for p in products[:20]:
            p_orders = [o for o in orders if o.product_id == p.id]
            produced = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                    DailyProductionReport.tenant_id == self.tenant_id,
                    DailyProductionReport.product_id == p.id,
                )) or 0)
            product_stats.append({
                "product_name": p.name,
                "sku": p.sku or "—",
                "total_orders": len(p_orders),
                "planned": sum(1 for o in p_orders if o.status in PLANNED),
                "in_progress": sum(1 for o in p_orders if o.status in IN_PROG),
                "completed": sum(1 for o in p_orders if o.status in DONE),
                "delayed": sum(1 for o in p_orders if is_del(o)),
                "cancelled": sum(1 for o in p_orders if o.status == "cancelled"),
                "total_produced_qty": produced,
                "produced_today": p.id in today_report_product_ids,
            })

        return {
            "summary": {
                "total_products": len(products),
                "products_produced_today": len(today_report_product_ids),
                "today_output_units": today_output,
                "total_planned_orders": sum(1 for o in orders if o.status in PLANNED),
                "total_in_progress": sum(1 for o in orders if o.status in IN_PROG),
                "total_completed": sum(1 for o in orders if o.status in DONE),
                "total_delayed": sum(1 for o in orders if is_del(o)),
                "total_cancelled": sum(1 for o in orders if o.status == "cancelled"),
            },
            "products": product_stats,
        }

    def get_work_order_stats_deep(self, query: str = "") -> dict:
        """Work-order statistics, optionally filtered by the requested status."""
        from sqlalchemy import select, func
        from app.models.production import WorkOrder as WO, ProductionOrder
        from app.models.product import Product
        from app.models.user import User as UserModel
        from datetime import datetime, timezone

        wos = list(self.db.scalars(
            select(WO).where(WO.tenant_id == self.tenant_id)
        ).all())

        PLANNED = {"planned", "draft", "pending", "material_ready", "machine_assigned", "machine_ready"}
        IN_PROG = {"in_progress", "running"}
        DONE    = {"completed", "closed", "done"}
        now = datetime.now(timezone.utc)
        query_text = (query or "").lower()
        status_filter = None
        if any(word in query_text for word in ("completed", "finished", "closed", "done")):
            status_filter = DONE
        elif any(word in query_text for word in ("in progress", "running", "active")):
            status_filter = IN_PROG
        elif any(word in query_text for word in ("planned", "scheduled", "pending", "open")):
            status_filter = PLANNED
        elif "paused" in query_text or "on hold" in query_text:
            status_filter = {"paused", "on_hold", "hold"}
        elif "cancelled" in query_text or "canceled" in query_text:
            status_filter = {"cancelled", "canceled"}
        report_wos = [w for w in wos if status_filter is None or w.status in status_filter]

        def is_del(wo):
            if wo.status in DONE or wo.status == "cancelled": return False
            if not wo.planned_end: return False
            pe = wo.planned_end if wo.planned_end.tzinfo else wo.planned_end.replace(tzinfo=timezone.utc)
            return pe < now

        today = date.today()
        today_wos = []
        for wo in wos:
            if wo.planned_start:
                ps = wo.planned_start.date() if hasattr(wo.planned_start, 'date') else wo.planned_start
                if ps == today:
                    today_wos.append(wo)

        # per-status breakdown
        active_wos = []
        for wo in [w for w in report_wos if w.status in IN_PROG][:10]:
            po = self.db.get(ProductionOrder, wo.production_order_id) if wo.production_order_id else None
            product = self.db.get(Product, po.product_id) if po else None
            machine = self.machines.get_by_id(wo.machine_id) if wo.machine_id else None
            operator = self.db.get(UserModel, wo.assigned_user_id) if wo.assigned_user_id else None
            planned = float(wo.planned_quantity or 0)
            produced = float(wo.actual_quantity or 0)
            active_wos.append({
                "work_order_number": wo.work_order_number,
                "status": wo.status,
                "priority": wo.priority or "medium",
                "product": product.name if product else "—",
                "machine": machine.code if machine else "—",
                "operator": (getattr(operator, "full_name", None) or getattr(operator, "email", "—")) if operator else "—",
                "shift": wo.shift or "—",
                "planned_qty": planned,
                "produced_qty": produced,
                "progress_pct": round(produced / planned * 100, 1) if planned else 0.0,
                "is_delayed": is_del(wo),
            })

        return {
            "summary": {
                "total_work_orders": len(report_wos),
                "today_work_orders": sum(1 for w in report_wos if w in today_wos),
                "planned": sum(1 for w in report_wos if w.status in PLANNED),
                "in_progress": sum(1 for w in report_wos if w.status in IN_PROG),
                "completed": sum(1 for w in report_wos if w.status in DONE),
                "delayed": sum(1 for w in report_wos if is_del(w)),
                "high_priority": sum(1 for w in report_wos if (w.priority or "").lower() == "high"),
                "paused": sum(1 for w in report_wos if w.status == "paused"),
                "cancelled": sum(1 for w in report_wos if w.status == "cancelled"),
            },
            "active_work_orders": active_wos,
        }

    def get_production_schedule_stats_deep(self) -> dict:
        """Production schedule stats: completed/pending/machine utilisation/operator presence/delayed/material shortage/target."""
        from sqlalchemy import select, func
        from app.models.production import WorkOrder as WO, ProductionOrder, DailyProductionReport
        from app.models.user import User as UserModel
        from app.services.manufacturing_workflow_service import get_bom_requirements
        from datetime import datetime, timezone

        wos = list(self.db.scalars(
            select(WO).where(WO.tenant_id == self.tenant_id)
        ).all())
        machines = self.machines.list_all()
        total_machines = len(machines)

        DONE = {"completed", "closed", "done"}
        PENDING = {"planned", "draft", "pending", "material_ready", "machine_assigned"}
        IN_PROG = {"in_progress", "running"}
        now = datetime.now(timezone.utc)

        def is_del(wo):
            if not wo.planned_end: return False
            pe = wo.planned_end if wo.planned_end.tzinfo else wo.planned_end.replace(tzinfo=timezone.utc)
            return pe < now and wo.status not in DONE and wo.status != "cancelled"

        # Machine utilization
        machines_with_active_wo = set()
        for wo in wos:
            if wo.machine_id and wo.status in IN_PROG:
                machines_with_active_wo.add(wo.machine_id)
        machine_util_pct = round(len(machines_with_active_wo) / total_machines * 100, 1) if total_machines else 0

        # Operator presence (distinct operators on active WOs)
        active_operator_ids = set(wo.assigned_user_id for wo in wos if wo.status in IN_PROG and wo.assigned_user_id)
        total_operators = int(self.db.scalar(select(func.count(UserModel.id)).where(UserModel.tenant_id == self.tenant_id)) or 0)

        # Material shortages — check all pending orders
        shortage_count = 0
        orders_with_shortage = []
        pending_orders = list(self.db.scalars(
            select(ProductionOrder).where(
                ProductionOrder.tenant_id == self.tenant_id,
                ProductionOrder.status.notin_(("cancelled", "completed", "closed", "done")),
            )
        ).all())[:10]
        for order in pending_orders:
            try:
                reqs = get_bom_requirements(self.db, self.tenant_id, order.product_id, float(order.planned_quantity or 0))
                shorts = [r for r in reqs if not r.get("enough", True)]
                if shorts:
                    shortage_count += 1
                    orders_with_shortage.append({
                        "order": order.order_number,
                        "shortage_items": len(shorts),
                    })
            except Exception:
                pass

        # Today's production vs target
        today = date.today()
        today_output = float(self.db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )) or 0)
        today_scrap = float(self.db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )) or 0)
        dpr_target = float(self.db.scalar(
            select(func.coalesce(func.sum(DailyProductionReport.planned_quantity), 0)).where(
                DailyProductionReport.tenant_id == self.tenant_id,
                DailyProductionReport.report_date == today,
            )) or 0)

        if dpr_target > 0:
            today_target = dpr_target
        else:
            po_today_target = float(self.db.scalar(
                select(func.coalesce(func.sum(ProductionOrder.planned_quantity), 0)).where(
                    ProductionOrder.tenant_id == self.tenant_id,
                    ProductionOrder.status.in_(tuple(IN_PROG | PENDING)),
                    (func.date(ProductionOrder.start_date) == today) | (func.date(ProductionOrder.due_date) == today),
                )) or 0)

            wo_today_target = float(self.db.scalar(
                select(func.coalesce(func.sum(WO.planned_quantity), 0)).where(
                    WO.tenant_id == self.tenant_id,
                    WO.status.in_(tuple(IN_PROG | PENDING)),
                    (func.date(WO.planned_start) == today) | (func.date(WO.planned_end) == today),
                )) or 0)

            today_target = po_today_target or wo_today_target

        # Schedule list (compact)
        schedule_rows = []
        for wo in sorted(wos, key=lambda x: (x.planned_start or datetime.max.replace(tzinfo=timezone.utc)))[:15]:
            if wo.status == "cancelled": continue
            from app.models.product import Product
            po = self.db.get(ProductionOrder, wo.production_order_id) if wo.production_order_id else None
            product = self.db.get(Product, po.product_id) if po else None
            machine = self.machines.get_by_id(wo.machine_id) if wo.machine_id else None
            operator = self.db.get(UserModel, wo.assigned_user_id) if wo.assigned_user_id else None
            planned = float(wo.planned_quantity or 0)
            produced = float(wo.actual_quantity or 0)
            schedule_rows.append({
                "work_order": wo.work_order_number,
                "product": product.name if product else "—",
                "machine": machine.code if machine else "—",
                "operator": (getattr(operator, "full_name", None) or getattr(operator, "email", "—")) if operator else "—",
                "shift": wo.shift or "—",
                "status": wo.status,
                "priority": wo.priority or "medium",
                "progress_pct": round(produced / planned * 100, 1) if planned else 0.0,
                "is_delayed": is_del(wo),
                "planned_start": str(wo.planned_start)[:16] if wo.planned_start else "—",
                "planned_end": str(wo.planned_end)[:16] if wo.planned_end else "—",
            })

        return {
            "summary": {
                "total_scheduled": len(wos),
                "completed": sum(1 for w in wos if w.status in DONE),
                "pending": sum(1 for w in wos if w.status in PENDING),
                "in_progress": sum(1 for w in wos if w.status in IN_PROG),
                "delayed": sum(1 for w in wos if is_del(w)),
            },
            "machine_utilization": {
                "total_machines": total_machines,
                "active_machines": len(machines_with_active_wo),
                "utilization_pct": machine_util_pct,
            },
            "operator_presence": {
                "total_operators": total_operators,
                "operators_on_floor": len(active_operator_ids),
                "presence_pct": round(len(active_operator_ids) / total_operators * 100, 1) if total_operators else 0,
            },
            "material_shortage": {
                "orders_with_shortage": shortage_count,
                "details": orders_with_shortage,
            },
            "production_target": {
                "today_date": str(today),
                "today_output": today_output,
                "today_scrap": today_scrap,
                "today_target": today_target,
                "achievement_pct": round(today_output / today_target * 100, 1) if today_target else 0,
            },
            "schedule": schedule_rows,
        }

    def get_machine_allocation_deep(self) -> dict:
        """Machine allocation: WO, product, machine, operator, shift, supervisor, capacity, status, total/allocated/free/maintenance/utilization."""
        from sqlalchemy import select
        from app.models.production import WorkOrder as WO, ProductionOrder
        from app.models.product import Product
        from app.models.user import User as UserModel

        machines = self.machines.list_all()
        total = len(machines)
        ALLOC_STATUS = {"planned", "released", "material_ready", "machine_ready", "running", "in_progress"}

        allocated_ids = set()
        maintenance_ids = set()
        offline_ids = set()
        free_ids = set()

        for m in machines:
            status = (m.status or "").lower()
            if status in ("maintenance", "breakdown", "repair"):
                maintenance_ids.add(m.id)
            elif status in ("offline", "inactive", "disabled"):
                offline_ids.add(m.id)
            else:
                has_active = self.db.scalar(
                    select(WO.id).where(
                        WO.machine_id == m.id,
                        WO.tenant_id == self.tenant_id,
                        WO.status.in_(ALLOC_STATUS),
                    ).limit(1)
                )
                if has_active:
                    allocated_ids.add(m.id)
                else:
                    free_ids.add(m.id)

        free_count = len(free_ids)
        util_pct = round(len(allocated_ids) / total * 100, 1) if total else 0

        # Per-machine allocation rows
        rows = []
        for m in machines:
            wo = self.db.scalars(
                select(WO).where(
                    WO.machine_id == m.id,
                    WO.tenant_id == self.tenant_id,
                    WO.status.in_(ALLOC_STATUS),
                ).order_by(WO.id.desc())
            ).first()

            po = self.db.get(ProductionOrder, wo.production_order_id) if wo and wo.production_order_id else None
            product = self.db.get(Product, po.product_id) if po else None
            operator = self.db.get(UserModel, wo.assigned_user_id) if wo and wo.assigned_user_id else None

            planned = float(wo.planned_quantity or 0) if wo else 0
            produced = float(wo.actual_quantity or 0) if wo else 0
            capacity_pct = round(produced / planned * 100, 1) if planned else 0

            rows.append({
                "machine_code": m.code,
                "machine_name": m.name,
                "machine_type": getattr(m, "machine_type", "—") or "—",
                "machine_status": m.status,
                "location": getattr(m, "location", "—") or "—",
                "is_allocated": m.id in allocated_ids,
                "work_order": wo.work_order_number if wo else None,
                "product": product.name if product else None,
                "operator": (getattr(operator, "full_name", None) or getattr(operator, "email", "—")) if operator else None,
                "shift": wo.shift if wo else None,
                "supervisor": wo.supervisor if wo else None,
                "priority": wo.priority if wo else None,
                "capacity_pct": capacity_pct,
                "planned_qty": planned,
                "produced_qty": produced,
            })

        return {
            "summary": {
                "total_machines": total,
                "allocated": len(allocated_ids),
                "free_machines": max(free_count, 0),
                "under_maintenance": len(maintenance_ids),
                "offline": len(offline_ids),
                "utilization_pct": util_pct,
            },
            "machines": rows,
        }

    def get_batch_summary_deep(self) -> dict:
        """Batch summary: total, running, completed, hold, rejected, expired."""
        from sqlalchemy import select, func
        from app.models.production import Batch, WorkOrder as WO, ProductionOrder
        from app.models.product import Product

        batches = list(self.db.scalars(
            select(Batch).where(Batch.tenant_id == self.tenant_id)
        ).all())

        STATUS_MAP = {
            "running": 0, "in_process": 0,
            "completed": 0,
            "hold": 0,
            "rejected": 0,
            "expired": 0,
            "other": 0,
        }
        for b in batches:
            s = (b.status or "").lower()
            if s in ("running", "in_process"):
                STATUS_MAP["running"] += 1
            elif s == "completed":
                STATUS_MAP["completed"] += 1
            elif s == "hold":
                STATUS_MAP["hold"] += 1
            elif s == "rejected":
                STATUS_MAP["rejected"] += 1
            elif s == "expired":
                STATUS_MAP["expired"] += 1
            else:
                STATUS_MAP["other"] += 1

        total_qty = float(self.db.scalar(
            select(func.coalesce(func.sum(Batch.quantity), 0)).where(Batch.tenant_id == self.tenant_id)
        ) or 0)

        # Recent batches
        recent = []
        for b in sorted(batches, key=lambda x: x.id, reverse=True)[:10]:
            wo = self.db.get(WO, b.work_order_id) if b.work_order_id else None
            po = self.db.get(ProductionOrder, wo.production_order_id) if wo and wo.production_order_id else None
            product = self.db.get(Product, po.product_id) if po else None
            qty = float(b.quantity or 0)
            from app.models.production import DailyProductionReport
            scrap_from_report = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.scrap_quantity), 0)).where(
                    DailyProductionReport.tenant_id == self.tenant_id,
                    DailyProductionReport.work_order_id == b.work_order_id,
                )
            ) or 0) if b.work_order_id else 0.0

            raw_scrap = getattr(b, "scrap_quantity", None) or getattr(b, "scrap_qty", None) or scrap_from_report or (getattr(wo, "scrap_quantity", None) if wo else None)
            scrap_qty = round(float(raw_scrap or 0.0), 1)
            raw_good = getattr(b, "good_quantity", None) or getattr(b, "good_qty", None)
            good_qty = round(float(raw_good), 1) if raw_good is not None else round(max(0.0, qty - scrap_qty), 1)
            recent.append({
                "batch_code": b.batch_code or f"BATCH-{b.id}",
                "status": b.status or "—",
                "product": product.name if product else "—",
                "work_order": wo.work_order_number if wo else "—",
                "quantity": qty,
                "good_qty": good_qty,
                "scrap_qty": scrap_qty,
                "yield_pct": round(good_qty / qty * 100, 1) if qty else 0,
                "produced_at": str(b.produced_at)[:10] if hasattr(b, "produced_at") and b.produced_at else "—",
            })

        return {
            "summary": {
                "total_batches": len(batches),
                "running": STATUS_MAP["running"],
                "completed": STATUS_MAP["completed"],
                "hold": STATUS_MAP["hold"],
                "rejected": STATUS_MAP["rejected"],
                "expired": STATUS_MAP["expired"],
                "total_quantity": total_qty,
            },
            "recent_batches": recent,
        }

    def get_machine_status_deep(self) -> dict:
        """Machine status: total, running, idle, maintenance, breakdown, offline with details."""
        from sqlalchemy import select, func
        from app.models.production import WorkOrder as WO, DailyProductionReport

        machines = self.machines.list_all()
        total = len(machines)

        ALLOC = {"planned", "released", "material_ready", "machine_ready", "running", "in_progress"}

        running_m = idle_m = maint_m = breakdown_m = offline_m = other_m = 0
        machine_rows = []

        today = date.today()

        for m in machines:
            s = (m.status or "").lower()
            if s in ("running", "active"):
                running_m += 1
            elif s == "idle":
                idle_m += 1
            elif s == "maintenance":
                maint_m += 1
            elif s == "breakdown":
                breakdown_m += 1
            elif s in ("offline", "inactive"):
                offline_m += 1
            else:
                other_m += 1

            # active work order on this machine
            active_wo = self.db.scalars(
                select(WO).where(
                    WO.machine_id == m.id,
                    WO.tenant_id == self.tenant_id,
                    WO.status.in_(ALLOC),
                ).order_by(WO.id.desc())
            ).first()

            # today's output from daily reports
            today_output = float(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
                    DailyProductionReport.machine_id == m.id,
                    DailyProductionReport.tenant_id == self.tenant_id,
                    DailyProductionReport.report_date == today,
                )) or 0)
            today_downtime = int(self.db.scalar(
                select(func.coalesce(func.sum(DailyProductionReport.downtime_minutes), 0)).where(
                    DailyProductionReport.machine_id == m.id,
                    DailyProductionReport.tenant_id == self.tenant_id,
                    DailyProductionReport.report_date == today,
                )) or 0)

            machine_rows.append({
                "machine_code": m.code,
                "machine_name": m.name,
                "machine_type": getattr(m, "machine_type", "—") or "—",
                "status": m.status,
                "location": getattr(m, "location", "—") or "—",
                "department": getattr(m, "department", "—") or "—",
                "health_score": getattr(m, "health_score", None),
                "oee": getattr(m, "oee", None),
                "efficiency": getattr(m, "efficiency_pct", None),
                "last_maintenance": str(getattr(m, "last_maintenance_date", None) or "—")[:10],
                "next_maintenance": str(getattr(m, "next_maintenance_date", None) or "—")[:10],
                "active_work_order": active_wo.work_order_number if active_wo else None,
                "today_output": today_output,
                "today_downtime_min": today_downtime,
            })

        util_pct = round(running_m / total * 100, 1) if total else 0

        return {
            "summary": {
                "total_machines": total,
                "running": running_m,
                "idle": idle_m,
                "maintenance": maint_m,
                "breakdown": breakdown_m,
                "offline": offline_m,
                "other": other_m,
                "utilization_pct": util_pct,
            },
            "machines": machine_rows,
        }

