"""Manufacturing production toolkit dashboard aggregations (database-backed)."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.hr import (
    AttendanceRecord,
    Employee,
    SafetyIncident,
    Shift,
    TrainingEnrollment,
)
from app.models.machine import Machine, MachineStatusEvent
from app.models.maintenance import BreakdownReport
from app.services.process_checklist_service import aggregate_checklist_metrics, item_to_register_row
from app.models.manufacturing_toolkit import ManufacturingIssue, ProcessChecklistItem
from app.models.production import DailyProductionReport, ProductionEntry
from app.models.quality import ComplianceLog, Defect, QualityInspection
from app.models.user import User
from app.schemas.manufacturing_toolkit import ToolkitDashboardRead, ToolkitKpi
from app.services.manufacturing_toolkit_metrics import (
    RUNNING_STATUSES,
    calendar_days_inclusive,
    default_month_range,
    event_hours_in_range,
    utilization_summary,
)
from app.services.production_service import list_daily_production_reports

TOOLKIT_IDS = frozenset(
    {
        "quality_management_plan",
        "equipment_inventory",
        "utilization_rate",
        "labour_productivity",
        "timesheet_tracking",
        "daily_work_log",
        "process_checklist",
        "incident_report",
        "issue_log",
    }
)


def _fmt(value: float | int | None, decimals: int = 0) -> str | None:
    if value is None:
        return None
    if decimals == 0:
        return str(int(round(value)))
    return str(round(float(value), decimals))


def _kpi(key: str, label: str, value: str | None, unit: str = "", tone: str = "blue") -> ToolkitKpi:
    display = "—" if value is None else value
    return ToolkitKpi(key=key, label=label, value=display, unit=unit or "", tone=tone)


def _shift_capacity_hours(db: Session, tenant_id: int) -> float:
    shifts = list(
        db.scalars(
            select(Shift).where(Shift.tenant_id == tenant_id, Shift.is_active.is_(True))
        ).all()
    )
    if not shifts:
        return 8.0
    return float(sum(float(s.capacity_hours or 8) for s in shifts) / len(shifts))


def get_toolkit_dashboard(
    db: Session,
    tenant_id: int,
    toolkit_id: str,
    date_from: date | None,
    date_to: date | None,
    user: User | None = None,
    limit: int = 100,
) -> ToolkitDashboardRead:
    if toolkit_id not in TOOLKIT_IDS:
        raise ValueError(f"Unknown toolkit_id: {toolkit_id}")
    d_from, d_to = date_from, date_to
    if d_from is None and d_to is None:
        d_from, d_to = default_month_range()
    elif d_from is None:
        d_from = d_to
    elif d_to is None:
        d_to = date.today()
    if d_to < d_from:
        d_from, d_to = d_to, d_from

    builders: dict[str, Callable[..., ToolkitDashboardRead]] = {
        "quality_management_plan": _quality_management_plan,
        "equipment_inventory": _equipment_inventory,
        "utilization_rate": _utilization_rate,
        "labour_productivity": _labour_productivity,
        "timesheet_tracking": _timesheet_tracking,
        "daily_work_log": _daily_work_log,
        "process_checklist": _process_checklist,
        "incident_report": _incident_report,
        "issue_log": _issue_log,
    }
    return builders[toolkit_id](db, tenant_id, d_from, d_to, user=user, limit=limit)


def _quality_management_plan(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    year = d_to.year
    inspections = list(
        db.scalars(select(QualityInspection).where(QualityInspection.tenant_id == tenant_id)).all()
    )
    audits = [
        i
        for i in inspections
        if "audit" in (i.inspection_type or "").lower()
        or (i.inspection_date and i.inspection_date.year == year)
    ]
    audits_planned = sum(1 for i in audits if i.inspection_date and i.inspection_date.year == year)
    audits_done = sum(
        1
        for i in audits
        if i.inspection_date
        and i.inspection_date.year == year
        and (
            i.status in ("completed", "closed", "approved")
            or i.result in ("pass", "fail", "conditional")
        )
    )
    defects = list(db.scalars(select(Defect).where(Defect.tenant_id == tenant_id)).all())
    capa_open = sum(1 for d in defects if d.status not in ("closed", "resolved"))
    enrollments = list(
        db.scalars(select(TrainingEnrollment).where(TrainingEnrollment.tenant_id == tenant_id)).all()
    )
    training_pct = None
    if enrollments:
        completed = sum(1 for e in enrollments if e.status in ("completed", "certified"))
        training_pct = round(completed / len(enrollments) * 100, 1)

    sup_scores = []
    sup_map: dict[str, dict] = {}
    for i in inspections:
        if not i.vendor_name:
            continue
        sup_map.setdefault(i.vendor_name, {"t": 0, "p": 0})
        sup_map[i.vendor_name]["t"] += 1
        if i.result == "pass":
            sup_map[i.vendor_name]["p"] += 1
    for v in sup_map.values():
        if v["t"]:
            sup_scores.append(v["p"] / v["t"] * 100)
    supplier_score = round(sum(sup_scores) / len(sup_scores), 1) if sup_scores else None

    compliance_logs = list(
        db.scalars(select(ComplianceLog).where(ComplianceLog.tenant_id == tenant_id)).all()
    )
    compliance_label = None
    if compliance_logs:
        bad = sum(1 for c in compliance_logs if c.status not in ("completed", "compliant", "closed"))
        compliance_label = "Compliant" if bad == 0 else "Review Required"

    objectives_active = sum(
        1 for c in compliance_logs if c.log_type and "objective" in c.log_type.lower()
    ) or len({d.defect_code for d in defects if d.status not in ("closed", "resolved")})

    kpis = [
        _kpi("objectives", "Quality Objectives", _fmt(objectives_active), "Active", "blue"),
        _kpi("audits_planned", "Audits Planned", _fmt(audits_planned), str(year), "teal"),
        _kpi(
            "audits_completed",
            "Audits Completed",
            _fmt(audits_done),
            f"{round(audits_done / audits_planned * 100)}%" if audits_planned else None,
            "green",
        ),
        _kpi("capa", "CAPA Actions", _fmt(len(defects)), f"{capa_open} open", "orange"),
        _kpi("training", "Training Complete", _fmt(training_pct), "%", "purple"),
        _kpi("supplier", "Supplier Score", _fmt(supplier_score, 1), "%", "lime"),
        _kpi("compliance", "Compliance", compliance_label, "", "green"),
    ]

    initiatives = []
    for c in compliance_logs[: limit // 2]:
        initiatives.append(
            {
                "init": c.description or c.log_type or c.reference or "Compliance item",
                "dept": c.log_type or "Quality",
                "owner": "—",
                "target": c.logged_at.date().isoformat() if c.logged_at else "—",
                "status": "completed" if c.status in ("completed", "compliant") else "on_track",
            }
        )
    for d in defects:
        if d.status in ("closed", "resolved"):
            continue
        initiatives.append(
            {
                "init": d.description or d.defect_code,
                "dept": d.department or "Quality",
                "owner": d.assigned_to or "—",
                "target": d.due_date.isoformat() if d.due_date else "—",
                "status": "at_risk" if d.severity in ("critical", "high") else "on_track",
            }
        )
        if len(initiatives) >= limit:
            break

    capa_donut = [
        {"name": "Open", "value": sum(1 for d in defects if d.status in ("open", "new"))},
        {"name": "In Progress", "value": sum(1 for d in defects if d.status == "in_progress")},
        {"name": "Closed", "value": sum(1 for d in defects if d.status in ("closed", "resolved"))},
    ]
    capa_donut = [x for x in capa_donut if x["value"] > 0]

    return ToolkitDashboardRead(
        toolkit_id="quality_management_plan",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(inspections or defects or compliance_logs or enrollments),
        kpis=kpis,
        table_rows=initiatives[:limit],
        charts={"capa_donut": capa_donut},
        insights=[],
        kpi_definitions=[
            {"kpi": "CAPA Actions", "formula": "Count of quality defects (CAPA register)"},
            {"kpi": "Training Complete", "formula": "Completed enrollments / total enrollments"},
        ],
    )


def _equipment_inventory(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    machines = list(
        db.scalars(select(Machine).where(Machine.tenant_id == tenant_id)).all()
    )
    active = [m for m in machines if m.is_active]
    under_maint = sum(1 for m in machines if (m.status or "").lower() in ("maintenance", "repair"))
    idle = sum(1 for m in machines if (m.status or "").lower() in ("idle", "stopped"))
    today = date.today()
    cal_due = sum(
        1
        for m in machines
        if m.next_maintenance_date and m.next_maintenance_date <= today + timedelta(days=60)
    )
    dept_counts: dict[str, int] = {}
    for m in machines:
        dept = m.department or "Unassigned"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1

    rows = []
    for m in machines[:limit]:
        rows.append(
            {
                "id": m.code,
                "name": m.name,
                "cat": m.machine_type or "Equipment",
                "dept": m.department or "—",
                "value": None,
                "status": (m.status or "idle").lower(),
            }
        )

    kpis = [
        _kpi("total", "Total Equipment", _fmt(len(machines)), "Assets", "blue"),
        _kpi(
            "active",
            "Active",
            _fmt(len(active)),
            f"{round(len(active) / len(machines) * 100, 1)}%" if machines else None,
            "green",
        ),
        _kpi("maint", "Under Maintenance", _fmt(under_maint), "", "orange"),
        _kpi("idle", "Idle", _fmt(idle), "", "blue"),
        _kpi("cal", "Calibration Due", _fmt(cal_due), "", "red"),
        _kpi("asset_value", "Asset Value", None, "", "purple"),
    ]

    return ToolkitDashboardRead(
        toolkit_id="equipment_inventory",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(machines),
        kpis=kpis,
        table_rows=rows,
        charts={
            "dept_bar": [{"name": k, "c": v} for k, v in sorted(dept_counts.items(), key=lambda x: -x[1])]
        },
        insights=["Asset value requires machine purchase cost (not stored on machine master)."] if machines else [],
        kpi_definitions=[
            {"kpi": "Asset Value", "formula": "Unavailable — no purchase_cost on machines table"},
        ],
    )


def _utilization_rate(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    machines = list(
        db.scalars(
            select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active.is_(True))
        ).all()
    )
    days = calendar_days_inclusive(d_from, d_to)
    shift_h = _shift_capacity_hours(db, tenant_id)
    events = list(
        db.scalars(
            select(MachineStatusEvent).where(
                MachineStatusEvent.tenant_id == tenant_id,
            )
        ).all()
    )
    utilized = 0.0
    per_machine: dict[int, float] = {}
    for ev in events:
        if (ev.status or "").lower() not in RUNNING_STATUSES:
            continue
        hrs = event_hours_in_range(ev.started_at, ev.ended_at, d_from, d_to)
        if hrs <= 0:
            continue
        utilized += hrs
        per_machine[ev.machine_id] = per_machine.get(ev.machine_id, 0.0) + hrs

    summary = utilization_summary(
        num_active_machines=len(machines),
        shift_capacity_hours=shift_h,
        days=days,
        utilized_hours=utilized,
    )

    rows = []
    underutilized = 0
    for m in machines[:limit]:
        avail = shift_h * days
        used = per_machine.get(m.id, 0.0)
        util = round(used / avail * 100, 1) if avail > 0 else None
        status = "on_track"
        if util is not None:
            if util < 70:
                status = "underutilized"
                underutilized += 1
            elif util >= 95:
                status = "constrained"
        rows.append(
            {
                "res": m.name,
                "dept": m.department or "Production",
                "planned": round(avail, 1),
                "used": round(used, 1),
                "util": util,
                "var": None,
                "status": status,
            }
        )

    kpis = [
        _kpi("avg_util", "Avg Utilization", _fmt(summary["utilization_pct"], 1), "%", "green"),
        _kpi("planned", "Planned Hours", _fmt(summary["available_hours"], 0), "", "blue"),
        _kpi("utilized", "Utilized Hours", _fmt(summary["utilized_hours"], 0), "", "teal"),
        _kpi("idle", "Idle Hours", _fmt(summary["idle_hours"], 0), "", "red"),
        _kpi("line_eff", "Line Efficiency", None, "%", "purple"),
        _kpi("under", "Underutilized", _fmt(underutilized), "Assets", "orange"),
        _kpi("load", "Capacity Load", _fmt(summary["utilization_pct"], 1), "%", "lime"),
    ]

    line_data = [{"month": r["res"][:12], "util": r["util"]} for r in rows if r["util"] is not None][:6]

    return ToolkitDashboardRead(
        toolkit_id="utilization_rate",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(machines) and summary["available_hours"] is not None,
        kpis=kpis,
        table_rows=rows,
        charts={"util_line": line_data},
        insights=[
            "Available hours = active machines × average shift capacity × days in range.",
            "Utilized hours from machine status events (running/active).",
        ],
        kpi_definitions=[
            {"kpi": "Avg Utilization", "formula": "Utilized hours ÷ available hours"},
        ],
    )


def _labour_productivity(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    emps = list(
        db.scalars(select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active)).all()
    )
    att = list(
        db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.record_date >= d_from,
                AttendanceRecord.record_date <= d_to,
            )
        ).all()
    )
    total_hrs = sum(float(a.work_hours or 0) + float(a.overtime_hours or 0) for a in att)
    ot_hrs = sum(float(a.overtime_hours or 0) for a in att)
    entries = list(
        db.scalars(
            select(ProductionEntry).where(
                ProductionEntry.tenant_id == tenant_id,
                ProductionEntry.recorded_at >= datetime.combine(d_from, datetime.min.time()),
                ProductionEntry.recorded_at <= datetime.combine(d_to, datetime.max.time()),
            )
        ).all()
    )
    total_output = sum(float(e.quantity_produced or 0) for e in entries)
    output_per_hr = round(total_output / total_hrs, 2) if total_hrs > 0 else None

    present_days = sum(1 for a in att if a.status == "present" or a.clock_in)
    expected_slots = len(emps) * max(1, calendar_days_inclusive(d_from, d_to))
    attendance_pct = round(present_days / expected_slots * 100, 1) if expected_slots and emps else None
    absenteeism = round(100 - attendance_pct, 1) if attendance_pct is not None else None

    users = list(db.scalars(select(User).where(User.tenant_id == tenant_id)).all())
    user_to_emp: dict[int, int] = {}
    code_to_emp = {e.employee_code: e.id for e in emps}
    for u in users:
        if u.employee_id and u.employee_id in code_to_emp:
            user_to_emp[u.id] = code_to_emp[u.employee_id]
    out_by_emp: dict[int, float] = {}
    for ent in entries:
        eid = user_to_emp.get(ent.operator_user_id)
        if eid:
            out_by_emp[eid] = out_by_emp.get(eid, 0.0) + float(ent.quantity_produced or 0)

    emp_att: dict[int, list[AttendanceRecord]] = {}
    for a in att:
        emp_att.setdefault(a.employee_id, []).append(a)
    rows = []
    dept_rates: dict[str, list[float]] = {}
    for e in emps[:limit]:
        recs = emp_att.get(e.id, [])
        hrs = sum(float(r.work_hours or 0) for r in recs)
        out = out_by_emp.get(e.id, 0.0)
        rate = round(out / hrs, 2) if hrs > 0 and out > 0 else None
        att_status = "present" if recs and any(r.clock_in for r in recs) else "absent"
        rows.append(
            {
                "team": e.full_name,
                "dept": e.department or "—",
                "shift": e.shift_name or "—",
                "hrs": round(hrs, 1),
                "out": int(out),
                "rate": rate,
                "att": att_status,
            }
        )
        if rate is not None and e.department:
            dept_rates.setdefault(e.department, []).append(rate)

    dept_bar = [
        {"name": k, "v": round(sum(v) / len(v), 2)} for k, v in dept_rates.items() if v
    ]

    productivity_score = None
    if output_per_hr is not None and attendance_pct is not None:
        productivity_score = round(min(100, output_per_hr * 5 + attendance_pct * 0.3), 1)

    kpis = [
        _kpi("labour_hrs", "Total Labour Hrs", _fmt(total_hrs, 0), "", "blue"),
        _kpi("out_per_hr", "Output / Labour Hr", _fmt(output_per_hr, 1), "Units", "green"),
        _kpi("attendance", "Attendance", _fmt(attendance_pct, 1), "%", "teal"),
        _kpi("ot", "Overtime Hrs", _fmt(ot_hrs, 0), "", "orange"),
        _kpi("score", "Productivity Score", _fmt(productivity_score, 1), "/100", "purple"),
        _kpi("absent", "Absenteeism", _fmt(absenteeism, 1), "%", "red"),
        _kpi("shift_eff", "Shift Efficiency", None, "%", "lime"),
    ]

    return ToolkitDashboardRead(
        toolkit_id="labour_productivity",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(att or entries),
        kpis=kpis,
        table_rows=rows,
        charts={"dept_productivity": dept_bar},
        kpi_definitions=[
            {"kpi": "Output / Labour Hr", "formula": "Sum production_entries.quantity ÷ sum attendance work hours"},
        ],
    )


def _timesheet_tracking(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    emps = list(
        db.scalars(select(Employee).where(Employee.tenant_id == tenant_id, Employee.is_active)).all()
    )
    att = list(
        db.scalars(
            select(AttendanceRecord).where(
                AttendanceRecord.tenant_id == tenant_id,
                AttendanceRecord.record_date >= d_from,
                AttendanceRecord.record_date <= d_to,
            )
        ).all()
    )
    reg = sum(float(a.work_hours or 0) for a in att)
    ot = sum(float(a.overtime_hours or 0) for a in att)
    pending = sum(1 for a in att if (a.approval_status or "pending") == "pending")
    approved = sum(1 for a in att if a.approval_status == "approved")
    emp_by_id = {e.id: e for e in emps}
    rows = []
    for a in sorted(att, key=lambda x: x.record_date, reverse=True)[:limit]:
        e = emp_by_id.get(a.employee_id)
        reg_h = float(a.work_hours or 0)
        ot_h = float(a.overtime_hours or 0)
        st = (a.approval_status or "pending").lower()
        if reg_h == 0 and ot_h == 0 and not a.clock_in:
            st = "missing"
        rows.append(
            {
                "emp": e.full_name if e else f"Employee #{a.employee_id}",
                "dept": e.department if e else "—",
                "date": a.record_date.strftime("%d-%b"),
                "reg": round(reg_h, 1),
                "ot": round(ot_h, 1),
                "total": round(reg_h + ot_h, 1),
                "status": st,
            }
        )

    days = calendar_days_inclusive(d_from, d_to)
    missing = max(0, len(emps) * days - len(att)) if emps else None

    labour_cost = None
    for e in emps:
        if e.hourly_rate:
            labour_cost = (labour_cost or 0) + float(e.hourly_rate) * reg
    labour_cost_str = f"₹{int(labour_cost):,}" if labour_cost is not None else None

    kpis = [
        _kpi("reg", "Regular Hours", _fmt(reg, 0), "", "blue"),
        _kpi("ot", "Overtime Hours", _fmt(ot, 0), "", "orange"),
        _kpi("submitted", "Submitted", _fmt(len(att)), "Sheets", "green"),
        _kpi("pending", "Pending Approval", _fmt(pending), "", "orange"),
        _kpi("missing", "Missing Entries", _fmt(missing), "", "red"),
        _kpi("active", "Active Employees", _fmt(len(emps)), "", "teal"),
        _kpi("cost", "Labour Cost", labour_cost_str, "", "purple"),
    ]

    donut = [
        {"name": "Approved", "value": approved},
        {"name": "Pending", "value": pending},
        {"name": "Other", "value": max(0, len(att) - approved - pending)},
    ]
    donut = [d for d in donut if d["value"] > 0]

    return ToolkitDashboardRead(
        toolkit_id="timesheet_tracking",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(att or emps),
        kpis=kpis,
        table_rows=rows,
        charts={"submission_donut": donut},
        kpi_definitions=[
            {"kpi": "Missing Entries", "formula": "Active employees × days − attendance rows (approximation)"},
        ],
    )


def _daily_work_log(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    reports = list_daily_production_reports(db, tenant_id, d_from, d_to, user=user)
    breakdowns = list(
        db.scalars(
            select(BreakdownReport).where(
                BreakdownReport.tenant_id == tenant_id,
                BreakdownReport.reported_at >= datetime.combine(d_from, datetime.min.time()),
                BreakdownReport.reported_at <= datetime.combine(d_to, datetime.max.time()),
            )
        ).all()
    )
    rows = []
    total_out = 0.0
    total_dt_min = 0
    completed = 0
    for r in reports[:limit]:
        planned = float(r.get("planned_quantity") or 0)
        actual = float(r.get("produced_quantity") or 0)
        total_out += actual
        dt = int(r.get("downtime_minutes") or 0)
        total_dt_min += dt
        st = "completed" if planned > 0 and actual >= planned else ("in_progress" if actual > 0 else "pending")
        if st == "completed":
            completed += 1
        rows.append(
            {
                "date": (r.get("report_date") or "")[5:10].replace("-", "-") if r.get("report_date") else "—",
                "shift": "—",
                "dept": r.get("machine_department") or r.get("department") or "Production",
                "activity": r.get("product_name") or r.get("notes") or "Production report",
                "mp": None,
                "target": int(planned) if planned else None,
                "actual": int(actual),
                "status": st,
            }
        )

    kpis = [
        _kpi("entries", "Log Entries", _fmt(len(reports)), "", "blue"),
        _kpi(
            "completed",
            "Tasks Completed",
            _fmt(completed),
            f"{round(completed / len(reports) * 100)}%" if reports else None,
            "green",
        ),
        _kpi("pending", "Pending Tasks", _fmt(max(0, len(reports) - completed)), "", "orange"),
        _kpi("manpower", "Manpower", None, "", "teal"),
        _kpi("output", "Output", _fmt(total_out, 0), "Units", "purple"),
        _kpi("downtime", "Downtime", _fmt(total_dt_min / 60, 1), "Hrs", "red"),
        _kpi("issues", "Issues", _fmt(len(breakdowns)), "", "red"),
    ]

    return ToolkitDashboardRead(
        toolkit_id="daily_work_log",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(reports),
        kpis=kpis,
        table_rows=rows,
        charts={},
        kpi_definitions=[
            {"kpi": "Issues", "formula": "Breakdown reports in date range"},
        ],
    )


def _process_checklist(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    """KPIs: items with due_date in [d_from,d_to] or null due_date and status not cancelled."""
    all_items = list(
        db.scalars(
            select(ProcessChecklistItem).where(
                ProcessChecklistItem.tenant_id == tenant_id,
                ProcessChecklistItem.status != "cancelled",
            )
        ).all()
    )
    items = [
        i
        for i in all_items
        if i.due_date is None or (d_from <= i.due_date <= d_to)
    ]
    metrics = aggregate_checklist_metrics(items)
    rows = [item_to_register_row(i) for i in items[:limit]]

    stage_map: dict[str, list[int]] = {}
    for i in items:
        stage_map.setdefault(i.process_stage, [0, 0])
        stage_map[i.process_stage][1] += 1
        if i.status in ("completed", "approved"):
            stage_map[i.process_stage][0] += 1
    stage_bar = [
        {"name": k[:10], "v": round(done / tot * 100, 1) if tot else 0}
        for k, (done, tot) in stage_map.items()
    ]

    kpis = [
        _kpi("total", "Total Items", _fmt(metrics["total"]), "", "blue"),
        _kpi("completed", "Completed", _fmt(metrics["completed"]), "", "green"),
        _kpi("pending", "Pending", _fmt(metrics["pending"]), "", "orange"),
        _kpi("failed", "Failed", _fmt(metrics["failed"]), "", "red"),
        _kpi("compliance", "Compliance", _fmt(metrics["compliance_pct"], 1), "%", "teal"),
        _kpi("overdue", "Overdue", _fmt(metrics["overdue"]), "", "red"),
        _kpi("approved", "Approved", _fmt(metrics["approved"]), "", "lime"),
    ]

    return ToolkitDashboardRead(
        toolkit_id="process_checklist",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(items),
        kpis=kpis,
        table_rows=rows,
        charts={"stage_bar": stage_bar},
        kpi_definitions=[
            {
                "kpi": "Compliance",
                "formula": "(completed + approved status count) / items in due-date window; cancelled excluded",
            },
            {
                "kpi": "Overdue",
                "formula": "due_date < today and status not completed/approved/cancelled",
            },
        ],
    )


def _incident_report(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    from app.services.safety_incident_service import aggregate_incident_metrics, incident_to_register_row

    from app.services.safety_incident_service import can_view_incident

    incidents = list(
        db.scalars(
            select(SafetyIncident).where(SafetyIncident.tenant_id == tenant_id)
        ).all()
    )
    if user is not None:
        incidents = [i for i in incidents if can_view_incident(db, user, i)]
    in_range = [i for i in incidents if i.incident_date and d_from <= i.incident_date <= d_to]
    metrics = aggregate_incident_metrics(in_range)
    rows = [incident_to_register_row(i) for i in in_range[:limit]]

    sev_map: dict[str, int] = {}
    for i in in_range:
        s = (i.severity or "minor").lower()
        sev_map[s] = sev_map.get(s, 0) + 1

    capa_value = None
    if metrics["capa_kpi_available"]:
        completed = metrics["capa_completed"] or 0
        pending = metrics["capa_pending"] or 0
        capa_value = _fmt(completed) if pending == 0 else f"{completed}/{completed + pending}"

    kpis = [
        _kpi("total", "Total Incidents", _fmt(metrics["total"]), "", "red"),
        _kpi("open", "Open Investigations", _fmt(metrics["open_investigations"]), "", "blue"),
        _kpi("closed", "Closed", _fmt(metrics["closed"]), "", "green"),
        _kpi("ltc", "Lost Time Cases", _fmt(metrics["lost_time"]), "", "red"),
        _kpi("near", "Near Misses", _fmt(metrics["near_miss"]), "", "blue"),
        _kpi("high", "High Severity", _fmt(metrics["high_severity"]), "", "red"),
        _kpi("capa", "Corrective Actions", capa_value, "", "teal"),
    ]

    return ToolkitDashboardRead(
        toolkit_id="incident_report",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(in_range),
        kpis=kpis,
        table_rows=rows,
        charts={"severity_donut": [{"name": k, "value": v} for k, v in sev_map.items()]},
        kpi_definitions=[
            {
                "kpi": "Corrective Actions",
                "formula": "completed corrective_action_status count / (completed + pending); unavailable until CAPA fields recorded",
            },
            {
                "kpi": "Lost Time Cases",
                "formula": "incident type contains 'lost' (case-insensitive)",
            },
        ],
    )


def _issue_log(
    db: Session, tenant_id: int, d_from: date, d_to: date, *, user: User | None, limit: int
) -> ToolkitDashboardRead:
    issues = list(
        db.scalars(
            select(ManufacturingIssue).where(
                ManufacturingIssue.tenant_id == tenant_id,
                ManufacturingIssue.raised_date >= d_from,
                ManufacturingIssue.raised_date <= d_to,
            )
        ).all()
    )
    defects = list(db.scalars(select(Defect).where(Defect.tenant_id == tenant_id)).all())
    today = date.today()
    combined = []
    resolution_days: list[float] = []
    for iss in issues:
        combined.append(
            {
                "id": iss.issue_code,
                "raised": iss.raised_date.strftime("%d-%b"),
                "dept": iss.department or "—",
                "title": iss.title,
                "priority": iss.priority,
                "owner": iss.owner_name or "—",
                "status": iss.status,
                "_age_base": iss.raised_date,
                "_target": iss.target_date,
            }
        )
        if iss.status == "closed" and iss.closed_at and iss.raised_date:
            days = (iss.closed_at.date() - iss.raised_date).days
            if days >= 0:
                resolution_days.append(float(days))
    for d in defects:
        rd = d.reported_at.date() if d.reported_at else today
        if not (d_from <= rd <= d_to):
            continue
        combined.append(
            {
                "id": d.defect_code,
                "raised": rd.strftime("%d-%b"),
                "dept": d.department or "Quality",
                "title": d.description,
                "priority": d.severity,
                "owner": d.assigned_to or "—",
                "status": d.status,
                "_age_base": rd,
                "_target": d.due_date,
            }
        )
    combined.sort(key=lambda x: x.get("_age_base") or today, reverse=True)
    filtered = combined
    combined = filtered[:limit]

    open_c = sum(1 for c in filtered if c["status"] not in ("closed", "resolved"))
    closed_c = sum(1 for c in filtered if c["status"] in ("closed", "resolved"))
    overdue = sum(
        1
        for c in filtered
        if c.get("_target") and c["_target"] < today and c["status"] not in ("closed", "resolved")
    )
    critical = sum(1 for c in filtered if (c.get("priority") or "").lower() in ("critical", "high"))

    pri_map: dict[str, int] = {}
    for c in filtered:
        p = (c.get("priority") or "medium").lower()
        pri_map[p] = pri_map.get(p, 0) + 1

    for c in combined:
        c.pop("_age_base", None)
        c.pop("_target", None)

    avg_res = None
    if resolution_days:
        avg_res = round(sum(resolution_days) / len(resolution_days), 1)
    owner_compliance = None
    with_owner = sum(1 for c in filtered if c.get("owner") and c["owner"] != "—")
    if filtered:
        owner_compliance = round(with_owner / len(filtered) * 100, 1)

    kpis = [
        _kpi("total", "Total Issues", _fmt(len(filtered)), "", "blue"),
        _kpi("open", "Open", _fmt(open_c), "", "red"),
        _kpi("closed", "Closed", _fmt(closed_c), "", "green"),
        _kpi("overdue", "Overdue", _fmt(overdue), "", "red"),
        _kpi("critical", "Critical", _fmt(critical), "", "red"),
        _kpi("avg_res", "Avg Resolution", _fmt(avg_res, 1), "Days", "teal"),
        _kpi("owner", "Owner Compliance", _fmt(owner_compliance, 1), "%", "lime"),
    ]

    return ToolkitDashboardRead(
        toolkit_id="issue_log",
        date_from=d_from,
        date_to=d_to,
        data_available=bool(filtered),
        kpis=kpis,
        table_rows=combined,
        charts={"priority_bar": [{"name": k, "v": v} for k, v in pri_map.items()]},
    )
