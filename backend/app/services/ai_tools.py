"""AI Operator Assistant — tool definitions and execution against real ERP data."""

from __future__ import annotations

import json
import logging
import re
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.permissions import get_role_names, user_has_permission, user_is_admin
from app.models.machine import Machine
from app.models.production import Batch, DailyProductionReport, ProductionOrder, WorkOrder
from app.models.user import User
from app.services.data_scope import operator_can_access_work_order, scope_work_orders
from app.services.production_service import get_work_order, list_work_orders, update_work_order
from app.services.schedule_service import get_schedule_dashboard
from app.services.work_order_service import get_work_order_detail, list_work_orders_enriched

logger = logging.getLogger(__name__)

FORBIDDEN_MODULES = frozenset({"accounts", "finance", "payroll", "admin", "settings"})

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_todays_work_orders",
            "description": "Get work orders scheduled or active for today for the current operator.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_order_by_number",
            "description": "Get details of a work order by its number e.g. WO-101.",
            "parameters": {
                "type": "object",
                "properties": {"work_order_number": {"type": "string"}},
                "required": ["work_order_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_todays_production_target",
            "description": "Get today's production target and completed quantity from daily production reports.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_machine_status",
            "description": "Get status of one machine by code (e.g. CNC-01) or all machines.",
            "parameters": {
                "type": "object",
                "properties": {"machine_code": {"type": "string"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_schedule",
            "description": "Get production schedule summary for today and upcoming jobs.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_batches",
            "description": "List pending or in-progress production batches.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_details",
            "description": "Get batch details by batch number.",
            "parameters": {
                "type": "object",
                "properties": {"batch_number": {"type": "string"}},
                "required": ["batch_number"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "work_order_action",
            "description": "Start, pause, resume, or complete a work order. Actions: start, pause, resume, complete.",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_order_number": {"type": "string"},
                    "action": {"type": "string", "enum": ["start", "pause", "resume", "complete"]},
                },
                "required": ["work_order_number", "action"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "report_machine_breakdown",
            "description": "Report a machine breakdown for maintenance.",
            "parameters": {
                "type": "object",
                "properties": {
                    "machine_code": {"type": "string"},
                    "description": {"type": "string"},
                },
                "required": ["machine_code", "description"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_todays_production",
            "description": "Get today's completed production quantity and remaining target.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "navigate_to_page",
            "description": "Navigate the user to an ERP page. Use for open work order, machine status, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "label": {"type": "string"},
                },
                "required": ["path"],
            },
        },
    },
]


def _roles(user: User) -> set[str]:
    return set(get_role_names(user))


def _is_operator(user: User) -> bool:
    return "Operator" in _roles(user) and not user_is_admin(user)


def _deny_if_forbidden(user: User, tool_name: str) -> str | None:
    blocked_tools = {
        "access_finance", "access_payroll", "delete_record", "edit_master",
    }
    if tool_name in blocked_tools:
        return "You do not have permission to perform this action."
    return None


def _serialize(obj: Any) -> Any:
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, list):
        return [_serialize(x) for x in obj]
    if isinstance(obj, dict):
        return {k: _serialize(v) for k, v in obj.items()}
    return obj


def _todays_production_totals(db: Session, tenant_id: int) -> tuple[int, int]:
    """Return (produced, target) from today's daily production reports, with fallback to entries & work orders."""
    today = date.today()
    reports = list(
        db.scalars(
            select(DailyProductionReport).where(
                DailyProductionReport.tenant_id == tenant_id,
                DailyProductionReport.report_date == today,
            )
        ).all()
    )
    produced = int(sum(float(r.produced_quantity or 0) for r in reports))
    target = int(sum(float(r.planned_quantity or 0) for r in reports))

    # If no daily report submitted yet, check today's production entries
    if produced == 0:
        try:
            from app.models.production_entry import ProductionEntry
            today_start = datetime.combine(today, datetime.min.time())
            entries = list(
                db.scalars(
                    select(ProductionEntry).where(
                        ProductionEntry.tenant_id == tenant_id,
                        ProductionEntry.recorded_at >= today_start,
                    )
                ).all()
            )
            if entries:
                produced = int(sum(float(e.quantity_produced or 0) for e in entries))
        except Exception:
            pass

    # If no planned target in daily report, check active work orders
    if target <= 0:
        try:
            wos = list(
                db.scalars(
                    select(WorkOrder).where(
                        WorkOrder.tenant_id == tenant_id,
                        WorkOrder.status.in_(["in_progress", "in-progress", "pending", "active", "planned", "released"]),
                    )
                ).all()
            )
            if wos:
                target = int(sum(float(wo.planned_quantity or 0) for wo in wos))
                if produced == 0:
                    produced = int(sum(float(wo.actual_quantity or 0) for wo in wos))
        except Exception:
            pass

    if target <= 0:
        try:
            pos = list(
                db.scalars(
                    select(ProductionOrder).where(
                        ProductionOrder.tenant_id == tenant_id,
                        ProductionOrder.status.in_(["in_progress", "in-progress", "pending", "active"]),
                    )
                ).all()
            )
            if pos:
                target = int(sum(float(o.planned_quantity or 0) for o in pos))
                if produced == 0:
                    produced = int(sum(float(o.produced_quantity or 0) for o in pos))
        except Exception:
            pass

    return produced, target


def _find_wo_by_number(db: Session, tenant_id: int, number: str, user: User) -> WorkOrder | None:
    normalized = number.strip().upper()
    stmt = select(WorkOrder).where(
        WorkOrder.tenant_id == tenant_id,
        func.upper(WorkOrder.work_order_number) == normalized,
    )
    stmt = scope_work_orders(stmt, user)
    return db.scalars(stmt).first()


def execute_tool(db: Session, user: User, tool_name: str, arguments: dict) -> dict:
    deny = _deny_if_forbidden(user, tool_name)
    if deny:
        return {"error": deny, "success": False}

    tenant_id = user.tenant_id
    today = date.today()

    try:
        if tool_name == "get_todays_work_orders":
            orders = list_work_orders_enriched(db, tenant_id, user=user)
            todays = [
                o for o in orders
                if o.planned_start and o.planned_start.date() == today
                or o.status in ("in_progress", "running", "paused")
            ]
            if not todays:
                todays = orders[:10]
            return {
                "success": True,
                "count": len(todays),
                "work_orders": [_serialize(o) for o in todays],
                "navigation": "/production/work-orders",
            }

        if tool_name == "get_work_order_by_number":
            num = arguments.get("work_order_number", "")
            wo = _find_wo_by_number(db, tenant_id, num, user)
            if not wo:
                return {"success": True, "found": False, "message": f"No work order found for {num}."}
            detail = get_work_order_detail(db, tenant_id, wo.id, user=user)
            return {
                "success": True,
                "found": True,
                "work_order": _serialize(detail),
                "navigation": f"/production/work-orders",
            }

        if tool_name == "get_todays_production_target":
            produced, target = _todays_production_totals(db, tenant_id)
            return {
                "success": True,
                "todays_target": target,
                "todays_production": produced,
                "remaining": max(target - produced, 0),
                "navigation": "/factory-monitor/machine-status",
            }

        if tool_name == "get_todays_production":
            produced, target = _todays_production_totals(db, tenant_id)
            return {
                "success": True,
                "completed_quantity": produced,
                "target": target,
                "remaining_quantity": max(target - produced, 0),
            }

        if tool_name == "get_machine_status":
            code = (arguments.get("machine_code") or "").strip().upper()
            if code:
                machine = db.scalar(
                    select(Machine).where(
                        Machine.tenant_id == tenant_id,
                        func.upper(Machine.code) == code,
                    )
                )
                if not machine:
                    return {"success": True, "found": False, "message": f"Machine {code} not found."}
                return {
                    "success": True,
                    "machines": [_serialize({
                        "code": machine.code,
                        "name": machine.name,
                        "status": machine.status,
                        "health_score": float(machine.health_score or 0),
                        "efficiency_pct": float(machine.efficiency_pct or 0),
                        "department": machine.department,
                    })],
                    "navigation": "/factory-monitor/machine-status",
                }
            machines = list(db.scalars(select(Machine).where(Machine.tenant_id == tenant_id, Machine.is_active)).all())
            return {
                "success": True,
                "count": len(machines),
                "machines": [_serialize({
                    "code": m.code, "name": m.name, "status": m.status,
                }) for m in machines[:15]],
                "navigation": "/factory-monitor/machine-status",
            }

        if tool_name == "get_production_schedule":
            dash = get_schedule_dashboard(db, tenant_id)
            return {"success": True, "schedule": _serialize(dash), "navigation": "/production/schedule"}

        if tool_name == "get_pending_batches":
            batches = list(
                db.scalars(
                    select(Batch).where(
                        Batch.tenant_id == tenant_id,
                        Batch.status.in_(("pending", "in_progress", "running", "planned")),
                    ).order_by(Batch.id.desc())
                ).all()
            )
            return {
                "success": True,
                "count": len(batches),
                "batches": [_serialize({
                    "batch_code": b.batch_code,
                    "status": b.status,
                    "quantity": float(b.quantity or 0),
                    "work_order_id": b.work_order_id,
                }) for b in batches[:15]],
                "navigation": "/production/batch-tracking",
            }

        if tool_name == "get_batch_details":
            num = (arguments.get("batch_number") or "").strip().upper()
            batch = db.scalar(
                select(Batch).where(
                    Batch.tenant_id == tenant_id,
                    func.upper(Batch.batch_code) == num,
                )
            )
            if not batch:
                return {"success": True, "found": False, "message": f"Batch {num} not found."}
            return {
                "success": True,
                "batch": _serialize(batch),
                "navigation": "/production/batch-tracking",
            }

        if tool_name == "work_order_action":
            num = arguments.get("work_order_number", "")
            action = (arguments.get("action") or "").lower()
            wo = _find_wo_by_number(db, tenant_id, num, user)
            if not wo:
                return {"success": False, "error": f"Work order {num} not found or not accessible."}
            if not operator_can_access_work_order(user, wo):
                return {"success": False, "error": "You cannot modify this work order."}
            status_map = {
                "start": "in_progress",
                "pause": "paused",
                "resume": "in_progress",
                "complete": "completed",
            }
            new_status = status_map.get(action)
            if not new_status:
                return {"success": False, "error": f"Unknown action: {action}"}
            update_work_order(db, wo.id, tenant_id, user=user, status=new_status)
            db.commit()
            return {
                "success": True,
                "work_order_number": wo.work_order_number,
                "new_status": new_status,
                "navigation": "/production/work-orders",
            }

        if tool_name == "report_machine_breakdown":
            code = (arguments.get("machine_code") or "").strip().upper()
            desc = arguments.get("description") or "Breakdown reported via AI assistant"
            machine = db.scalar(
                select(Machine).where(Machine.tenant_id == tenant_id, func.upper(Machine.code) == code)
            )
            if not machine:
                return {"success": False, "error": f"Machine {code} not found."}
            machine.status = "breakdown"
            db.commit()
            return {
                "success": True,
                "machine_code": code,
                "description": desc,
                "navigation": "/production/machines",
            }

        if tool_name == "navigate_to_page":
            path = arguments.get("path") or "/"
            return {"success": True, "navigation": path, "label": arguments.get("label")}

        return {"success": False, "error": f"Unknown tool: {tool_name}"}

    except Exception as exc:
        logger.exception("AI tool %s failed", tool_name)
        return {"success": False, "error": str(exc)}


# Rule-based intent fallback when LLM is unavailable
INTENT_RULES: list[tuple[str, str, dict]] = [
    (r"today.*(?:work\s*order|job\s*card)|(?:work\s*order|job\s*card).*today|నేటి.*(?:వర్క్|జాబ్)", "get_todays_work_orders", {}),
    (r"(?:my\s+)?job\s*cards?|show\s+job\s*cards?", "get_todays_work_orders", {}),
    (r"(?:my\s+)?work\s*orders?|show\s+work\s*orders?", "get_todays_work_orders", {}),
    (r"open\s+(?:work\s*order|job\s*card)\s+([\w-]+)|wo-?\s*(\d+)|jc-?\s*(\d+)", "get_work_order_by_number", {}),
    (r"today.*target|నేటి.*టార్గెట్|production\s*target", "get_todays_production_target", {}),
    (r"machine\s+([\w-]+)\s+status|([\w-]+)\s+status", "get_machine_status", {}),
    (r"machine\s+status|show\s+machines", "get_machine_status", {}),
    (r"production\s+schedule|schedule", "get_production_schedule", {}),
    (r"pending\s+batch|batch.*pending", "get_pending_batches", {}),
    (r"batch\s+([\w-]+)", "get_batch_details", {}),
    (r"start\s+production|start\s+([\w-]+)", "work_order_action", {"action": "start"}),
    (r"pause\s+production|pause\s+([\w-]+)", "work_order_action", {"action": "pause"}),
    (r"resume\s+production|resume\s+([\w-]+)", "work_order_action", {"action": "resume"}),
    (r"report\s+breakdown|breakdown", "report_machine_breakdown", {}),
    (r"today.*production|completed\s+quantity", "get_todays_production", {}),
]


def detect_intent(message: str) -> tuple[str, dict] | None:
    text = message.strip().lower()
    # Manufacturing synonyms used on shop floor
    text = re.sub(r"\bjob\s*cards?\b", "work orders", text)
    text = re.sub(r"\bjob\s*card\b", "work order", text)
    for pattern, tool, extra in INTENT_RULES:
        m = re.search(pattern, text, re.I)
        if not m:
            continue
        args = dict(extra)
        if tool == "get_work_order_by_number":
            wo = m.group(1) or (f"WO-{m.group(2)}" if m.lastindex and m.group(2) else None)
            if not wo and m.lastindex and len(m.groups()) >= 3 and m.group(3):
                wo = f"WO-{m.group(3)}"
            if wo:
                args["work_order_number"] = wo.upper().replace(" ", "")
        elif tool == "get_machine_status" and m.lastindex:
            code = m.group(1) or m.group(2)
            if code:
                args["machine_code"] = code.upper()
        elif tool == "get_batch_details" and m.group(1):
            args["batch_number"] = m.group(1).upper()
        elif tool == "work_order_action" and m.lastindex and m.group(1):
            args["work_order_number"] = m.group(1).upper()
        elif tool == "navigate_to_page":
            pass
        return tool, args
    return None


def format_tool_result(tool_name: str, result: dict) -> str:
    if result.get("error") and not result.get("success"):
        return result["error"]
    if tool_name == "get_todays_work_orders":
        if not result.get("work_orders"):
            return "There are no work orders assigned for today."
        lines = [f"**Today's Work Orders / Job Cards ({result['count']})**\n"]
        for wo in result["work_orders"][:8]:
            lines.append(
                f"- **{wo.get('work_order_number')}** — {wo.get('product_name') or 'N/A'} "
                f"({wo.get('status')}) — {wo.get('produced_quantity', 0)}/{wo.get('planned_quantity', 0)} units"
            )
        return "\n".join(lines)
    if tool_name == "get_todays_production_target":
        return (
            f"**Today's Production**\n"
            f"- Target: **{result.get('todays_target', 0):,}** units\n"
            f"- Completed: **{result.get('todays_production', 0):,}** units\n"
            f"- Remaining: **{result.get('remaining', 0):,}** units"
        )
    if tool_name == "get_machine_status" and result.get("machines"):
        lines = ["**Machine Status**\n"]
        for m in result["machines"][:10]:
            lines.append(f"- **{m.get('code')}** {m.get('name')} — {m.get('status')}")
        return "\n".join(lines)
    if tool_name == "clock_in":
        return "✅ Clock-in recorded successfully."
    if tool_name == "clock_out":
        return "✅ Clock-out recorded successfully."
    return json.dumps(result, indent=2, default=str)
