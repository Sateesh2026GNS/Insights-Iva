import logging
from datetime import date, datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

from app.models.maintenance import MaintenanceRecord, PreventiveMaintenance
from app.models.machine import Machine, MachineStatusEvent
from app.models.production import DailyProductionReport, WorkOrder
from app.models.user import User
from app.schemas.machine import (
    MachineCreateExtended,
    MachineDetailRead,
    MachineFullUpdate,
    MachineListRead,
    MachineMaintenanceRead,
    MachineStatusLogRead,
    MachineSummaryRead,
    MachineWorkOrderRead,
)
from app.services.production_service import list_machines


def _display_status(machine: Machine) -> str:
    if not machine.is_active:
        return "offline"
    s = (machine.status or "idle").lower()
    if s in ("down", "fault", "breakdown"):
        return "breakdown"
    return s


def _machine_context(db: Session, machine_id: int, tenant_id: int) -> dict:
    today = date.today()
    active_wo = db.scalars(
        select(WorkOrder)
        .where(
            WorkOrder.machine_id == machine_id,
            WorkOrder.tenant_id == tenant_id,
            WorkOrder.status.in_(("in_progress", "planned", "running")),
        )
        .order_by(WorkOrder.id.desc())
    ).first()

    todays_output = db.scalar(
        select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
            DailyProductionReport.machine_id == machine_id,
            DailyProductionReport.tenant_id == tenant_id,
            DailyProductionReport.report_date == today,
        )
    ) or 0

    return {
        "current_work_order": active_wo.work_order_number if active_wo else None,
        "current_product": None,
        "todays_output": int(todays_output),
        "target_quantity": int(active_wo.planned_quantity or 0) if active_wo else 0,
    }


def _to_list_read(db: Session, tenant_id: int, machine: Machine) -> MachineListRead:
    ctx = _machine_context(db, machine.id, tenant_id)
    data = MachineListRead.model_validate(machine)
    data.display_status = _display_status(machine)
    data.current_work_order = ctx["current_work_order"]
    data.current_product = ctx["current_product"]
    data.todays_output = ctx["todays_output"]
    data.target_quantity = ctx["target_quantity"]
    return data


def list_machines_enriched(
    db: Session, tenant_id: int, user: User | None = None
) -> list[MachineListRead]:
    machines = list_machines(db, tenant_id, user=user)
    return [_to_list_read(db, tenant_id, m) for m in machines]


def get_machine_summary(
    db: Session, tenant_id: int, user: User | None = None
) -> MachineSummaryRead:
    machines = list_machines(db, tenant_id, user=user)
    counts = {"running": 0, "idle": 0, "maintenance": 0, "breakdown": 0, "offline": 0}
    for m in machines:
        ds = _display_status(m)
        if ds in counts:
            counts[ds] += 1
        else:
            counts["idle"] += 1

    active_count = len([m for m in machines if m.is_active])
    util = round(counts["running"] / active_count * 100, 1) if active_count else 0

    today = date.today()
    todays_prod = db.scalar(
        select(func.coalesce(func.sum(DailyProductionReport.produced_quantity), 0)).where(
            DailyProductionReport.tenant_id == tenant_id,
            DailyProductionReport.report_date == today,
        )
    ) or 0

    return MachineSummaryRead(
        total_machines=len(machines),
        running=counts["running"],
        idle=counts["idle"],
        maintenance=counts["maintenance"],
        breakdown=counts["breakdown"],
        offline=counts["offline"],
        utilization_pct=util,
        todays_production=int(todays_prod),
    )


def get_machine_detail(
    db: Session, tenant_id: int, machine_id: int, user: User | None = None
) -> MachineDetailRead | None:
    stmt = select(Machine).where(Machine.id == machine_id, Machine.tenant_id == tenant_id)
    if user is not None and user.assigned_machine_id and "Operator" in {r.name for r in user.roles}:
        stmt = stmt.where(Machine.id == user.assigned_machine_id)
    elif user is not None and user.plant_code and "Production Manager" in {r.name for r in user.roles}:
        stmt = stmt.where((Machine.plant_code == user.plant_code) | (Machine.plant_code.is_(None)))
    machine = db.scalars(stmt).first()
    if not machine:
        return None

    detail = MachineDetailRead.model_validate(_to_list_read(db, tenant_id, machine))
    detail.availability_pct = machine.efficiency_pct
    detail.performance_pct = machine.oee_pct
    detail.quality_pct = machine.health_score

    work_orders = list(
        db.scalars(
            select(WorkOrder)
            .where(WorkOrder.machine_id == machine_id, WorkOrder.tenant_id == tenant_id)
            .order_by(WorkOrder.id.desc())
            .limit(15)
        ).all()
    )
    detail.work_orders = [MachineWorkOrderRead.model_validate(w) for w in work_orders]

    maintenance_records = list(
        db.scalars(
            select(MaintenanceRecord)
            .where(
                MaintenanceRecord.machine_id == machine_id,
                MaintenanceRecord.tenant_id == tenant_id,
            )
            .order_by(MaintenanceRecord.maintenance_date.desc(), MaintenanceRecord.id.desc())
            .limit(15)
        ).all()
    )
    if maintenance_records:
        detail.maintenance_history = [
            MachineMaintenanceRead.model_validate(r) for r in maintenance_records
        ]
    else:
        pm_records = list(
            db.scalars(
                select(PreventiveMaintenance)
                .where(
                    PreventiveMaintenance.machine_id == machine_id,
                    PreventiveMaintenance.tenant_id == tenant_id,
                )
                .order_by(PreventiveMaintenance.schedule_date.desc(), PreventiveMaintenance.id.desc())
                .limit(15)
            ).all()
        )
        detail.maintenance_history = [
            MachineMaintenanceRead(
                id=pm.id,
                maintenance_date=pm.schedule_date,
                maintenance_type=pm.maintenance_type or "preventive",
                description=pm.task_description,
                performed_by=pm.assigned_engineer,
            )
            for pm in pm_records
        ]

    logs = list(
        db.scalars(
            select(MachineStatusEvent)
            .where(
                MachineStatusEvent.machine_id == machine_id,
                MachineStatusEvent.tenant_id == tenant_id,
            )
            .order_by(MachineStatusEvent.started_at.desc())
            .limit(20)
        ).all()
    )
    detail.status_logs = [MachineStatusLogRead.model_validate(l) for l in logs]
    detail.downtime_minutes = 0
    detail.energy_kwh = round((machine.rpm or 0) * 0.05, 1) if machine.rpm else None
    return detail


def create_machine_extended(db: Session, payload: MachineCreateExtended) -> Machine:
    try:
        machine = Machine(**payload.model_dump())
        db.add(machine)
        db.commit()
        db.refresh(machine)
        return machine
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error creating machine code=%s: %s", getattr(payload, "code", None), exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while creating machine.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error creating machine: %s", exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise


def update_machine_full(
    db: Session, tenant_id: int, machine_id: int, payload: MachineFullUpdate
) -> Machine | None:
    try:
        machine = db.scalars(
            select(Machine).where(Machine.id == machine_id, Machine.tenant_id == tenant_id)
        ).first()
        if not machine:
            return None
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(machine, key, value)
        db.commit()
        db.refresh(machine)
        return machine
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error updating machine_id=%s tenant_id=%s: %s", machine_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while updating machine.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error updating machine_id=%s tenant_id=%s: %s", machine_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise


def delete_machine_full(db: Session, tenant_id: int, machine_id: int) -> bool:
    """Delete a machine when it has no linked work orders."""
    try:
        machine = db.scalars(
            select(Machine).where(Machine.id == machine_id, Machine.tenant_id == tenant_id)
        ).first()
        if not machine:
            return False

        linked_wo = db.scalar(
            select(func.count())
            .select_from(WorkOrder)
            .where(WorkOrder.machine_id == machine_id, WorkOrder.tenant_id == tenant_id)
        ) or 0
        if linked_wo:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Cannot delete machine with linked work orders. Reassign or complete them first.",
            )

        db.delete(machine)
        db.commit()
        return True
    except HTTPException:
        try:
            db.rollback()
        except Exception:
            pass
        raise
    except SQLAlchemyError as exc:
        logger.exception("Database error deleting machine_id=%s tenant_id=%s: %s", machine_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while deleting machine.",
        ) from exc
    except Exception as exc:
        logger.exception("Unexpected error deleting machine_id=%s tenant_id=%s: %s", machine_id, tenant_id, exc)
        try:
            db.rollback()
        except Exception:
            pass
        raise
