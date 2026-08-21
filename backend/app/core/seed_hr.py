"""Seed HR shifts only — no sample employees or attendance seeded."""

from datetime import time
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hr import Shift
from app.models.tenant import Tenant


def seed_hr_data(db: Session, tenant_id: int = 1) -> None:
    tenant = db.get(Tenant, tenant_id)
    if not tenant:
        return

    shifts_def = [
        {"name": "Day Shift", "start_time": time(8, 0), "end_time": time(16, 30), "break_minutes": 30, "capacity_hours": 8.0},
        {"name": "Night Shift", "start_time": time(20, 0), "end_time": time(4, 30), "break_minutes": 30, "capacity_hours": 8.0},
        {"name": "General Shift", "start_time": time(9, 0), "end_time": time(17, 30), "break_minutes": 30, "capacity_hours": 8.0},
    ]
    for s_info in shifts_def:
        exists = db.scalars(
            select(Shift).where(Shift.tenant_id == tenant_id, Shift.name == s_info["name"])
        ).first()
        if not exists:
            db.add(Shift(
                tenant_id=tenant_id,
                name=s_info["name"],
                start_time=s_info["start_time"],
                end_time=s_info["end_time"],
                break_minutes=s_info["break_minutes"],
                capacity_hours=s_info["capacity_hours"],
            ))

    db.commit()
