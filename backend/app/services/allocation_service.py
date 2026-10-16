import logging

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.machine import Machine
from app.models.product import Product
from app.models.production import ProductionOrder, WorkOrder
from app.models.user import User
from app.schemas.allocation import (
    AllocationAssignRequest,
    AllocationRowRead,
    AllocationSummaryRead,
    MachineAvailabilityRead,
)

ALLOCATED_STATUSES = ("assigned", "planned", "released", "material_ready", "machine_ready", "running", "in_progress")


def get_allocation_summary(db: Session, tenant_id: int) -> AllocationSummaryRead:
    try:
        machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id)).all())
        total = len(machines)
        maintenance = sum(1 for m in machines if m.status in ("maintenance", "breakdown"))
        allocated_ids = set()
        for m in machines:
            has = db.scalar(
                select(func.count(WorkOrder.id)).where(
                    WorkOrder.machine_id == m.id,
                    WorkOrder.tenant_id == tenant_id,
                    WorkOrder.status.in_(ALLOCATED_STATUSES),
                )
            )
            if has:
                allocated_ids.add(m.id)
        allocated = len(allocated_ids)
        free = total - allocated - maintenance
        util = round(allocated / total * 100, 1) if total else 0.0
        util = min(max(util, 0.0), 100.0)
        return AllocationSummaryRead(
            total_machines=total,
            allocated=allocated,
            free_machines=max(free, 0),
            under_maintenance=maintenance,
            utilization_pct=util,
        )
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during get_allocation_summary tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get allocation summary for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve allocation summary",
        ) from exc


def get_allocation_list(db: Session, tenant_id: int) -> list[AllocationRowRead]:
    try:
        wos = list(
            db.scalars(
                select(WorkOrder)
                .where(WorkOrder.tenant_id == tenant_id)
                .order_by(WorkOrder.id.desc())
                .limit(30)
            ).all()
        )
        rows = []
        for wo in wos:
            po = db.get(ProductionOrder, wo.production_order_id)
            product = db.get(Product, po.product_id) if po else None
            machine = db.get(Machine, wo.machine_id) if wo.machine_id else None
            user = db.get(User, wo.assigned_user_id) if wo.assigned_user_id else None
            op_name = wo.operator_name or (user.full_name if user else None) or (machine.assigned_operator if machine else None)
            shift_name = wo.shift or (machine.current_shift if machine else None)
            planned = float(wo.planned_quantity or 0)
            actual = float(wo.actual_quantity or 0)
            cap = round(actual / planned * 100, 1) if planned else 0.0
            cap = min(max(cap, 0.0), 100.0)
            status_val = "unassigned" if not wo.machine_id else wo.status
            rows.append(
                AllocationRowRead(
                    work_order_id=wo.id,
                    work_order_number=wo.work_order_number,
                    product_name=product.name if product else "—",
                    machine_id=wo.machine_id,
                    machine_name=machine.name if machine else None,
                    operator_name=op_name,
                    shift=shift_name,
                    supervisor=wo.supervisor,
                    capacity_pct=cap,
                    status=status_val,
                    priority=wo.priority or "medium",
                )
            )
        return rows
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during get_allocation_list tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get allocation list for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve allocation list",
        ) from exc


def get_machine_availability(db: Session, tenant_id: int) -> list[MachineAvailabilityRead]:
    try:
        machines = list(
            db.scalars(select(Machine).where(Machine.tenant_id == tenant_id).order_by(Machine.code)).all()
        )
        result = []
        for m in machines:
            wo = db.scalars(
                select(WorkOrder)
                .where(WorkOrder.machine_id == m.id, WorkOrder.tenant_id == tenant_id)
                .order_by(WorkOrder.id.desc())
            ).first()
            util = 90 if m.status == "running" else 60 if wo else 20 if m.status == "idle" else 0
            result.append(
                MachineAvailabilityRead(
                    machine_id=m.id,
                    machine_name=m.name,
                    status=m.status,
                    free_time="14:00" if m.status == "idle" else None,
                    current_job=wo.work_order_number if wo else None,
                    utilization_pct=util,
                )
            )
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during get_machine_availability tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to get machine availability for tenant_id=%s: %s", tenant_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve machine availability",
        ) from exc


def assign_allocation(db: Session, tenant_id: int, payload: AllocationAssignRequest) -> dict:
    if payload.work_order_id <= 0:
        return {"success": False, "message": "Invalid work order ID"}
    if payload.machine_id <= 0:
        return {"success": False, "message": "Invalid machine ID"}
    try:
        wo = db.scalars(
            select(WorkOrder).where(WorkOrder.id == payload.work_order_id, WorkOrder.tenant_id == tenant_id)
        ).first()
        if not wo:
            return {"success": False, "message": "Work order not found"}
        machine = db.scalars(
            select(Machine).where(Machine.id == payload.machine_id, Machine.tenant_id == tenant_id)
        ).first()
        if not machine:
            return {"success": False, "message": "Machine not found"}
        if machine.status in ("maintenance", "breakdown"):
            return {"success": False, "message": "Machine under maintenance"}
        wo.machine_id = payload.machine_id
        if payload.operator_name:
            wo.operator_name = payload.operator_name
            machine.assigned_operator = payload.operator_name
        if payload.shift:
            wo.shift = payload.shift
            machine.current_shift = payload.shift
        if payload.supervisor:
            wo.supervisor = payload.supervisor
        if wo.status == "released":
            wo.status = "machine_ready"
        db.commit()
        return {
            "success": True,
            "message": f"Assigned to {machine.name}",
            "work_order_id": wo.id,
            "machine_name": machine.name,
        }
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        db.rollback()
        logger.exception("Database error during assign_allocation work_order_id=%s: %s", payload.work_order_id, exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database connection unavailable",
        ) from exc
    except Exception as exc:
        db.rollback()
        logger.exception("Failed to assign allocation for work_order_id=%s: %s", payload.work_order_id, exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to assign work order allocation",
        ) from exc
