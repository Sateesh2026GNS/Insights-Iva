from __future__ import annotations

import logging
from datetime import date
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.operator import (
    BatchUpdateRequest,
    MachineBreakdownRequest,
    WorkOrderActionRequest,
    WorkOrderProgressRequest,
)
from app.services.operator_service import OperatorService

logger = logging.getLogger(__name__)

TOOL_DEFINITIONS: list[dict] = [
    {
        "type": "function",
        "function": {
            "name": "get_todays_work_orders",
            "description": (
            "Get today's work orders. Use this tool for ANY natural-language question "
            "about work orders for today, including: 'today work orders', "
            "'today's work orders', 'work orders today', 'work orders for today', "
            "'what are today's work orders?', 'show today's work orders', "
            "'list today's work orders', 'how many work orders today?', "
            "'how many work orders are there today?', 'today work order count', "
            "and 'today work orders count'. Return the actual current work orders "
            "and count from the ERP system. Do not use a generic total-order tool "
            "when the user explicitly says today."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_pending_work_orders",
            "description": "List pending work orders.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_assigned_work_orders",
            "description": "Get work orders assigned to the current operator.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_order_by_number",
            "description": "Get work order details by number e.g. WO-101.",
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
            "name": "get_todays_production",
            "description": "Get today's production target and completed quantity.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_machine_status",
            "description": "Get machine status by code or all machines.",
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
            "name": "get_running_machines",
            "description": "List currently running machines.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_schedule",
            "description": "Get today's production schedule.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_plan",
            "description": "Show today's production plan.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_status",
            "description": "Get running and completed batch status.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_details",
            "description": "Get batch by batch code.",
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
            "name": "clock_in",
            "description": "Clock in the operator for today.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "clock_out",
            "description": "Clock out the operator for today.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_my_attendance",
            "description": "Get attendance for the current operator.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "work_order_action",
            "description": "Start, pause, resume, or complete a work order.",
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
            "name": "update_production_progress",
            "description": "Update production progress quantity for a work order.",
            "parameters": {
                "type": "object",
                "properties": {
                    "work_order_number": {"type": "string"},
                    "produced_quantity": {"type": "number"},
                },
                "required": ["work_order_number", "produced_quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "report_machine_breakdown",
            "description": "Report a machine breakdown.",
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
    # ── Deep Intelligence Tools ──────────────────────────────────────────────
    {
        "type": "function",
        "function": {
            "name": "get_machine_deep_status",
            "description": (
                "Get comprehensive deep status of machines — including active work order, "
                "product being manufactured, manpower (operator, supervisor, shift), "
                "production progress, time to complete, days remaining, scrap, yield, "
                "OEE, efficiency, temperature, RPM, maintenance info. "
                "Use when user asks about running machines, active machines, machine for a product, "
                "manpower on machines, how long a machine will run, machine efficiency, or machine health."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional filter: machine code, product name, department, or status.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_order_deep",
            "description": (
                "Get comprehensive deep information about work orders — product, machine, operator, "
                "supervisor, shift, planned vs actual quantity, progress %, scrap, good yield, "
                "hours remaining, days to complete, delay status, materials issued, downtime. "
                "Use when user asks about work order details, progress, how long to finish, "
                "pending work orders in depth, high priority work orders, delayed work orders."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional filter: work order number, product, status, operator, customer.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_deep",
            "description": (
                "Get comprehensive deep batch information — product, quantity, good qty, scrap qty, "
                "yield %, QC status, dispatch status, traceability steps, machine, operator, shift, "
                "supervisor, customer, production order, material lot. "
                "Use when user asks about batch details, batch quality, batch traceability, "
                "batch yield, which batches are completed or running."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional filter: batch code, product, status, operator.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_plan_deep",
            "description": (
                "Get comprehensive deep production plan information — product, customer, planned vs actual, "
                "progress %, days remaining, work order breakdown (total/running/completed/pending), "
                "machine assigned, shift, department, sales order, BOM version, delay status. "
                "Use when user asks about production plans, order progress, delivery timeline, "
                "customer order status, production order details."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Optional filter: order number, product, customer, status.",
                    }
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_shopfloor_deep",
            "description": (
                "Get complete shop floor live snapshot — total/running/idle/breakdown machines, "
                "operators working count, today's production output, scrap, downtime, OEE, "
                "per-job detail (product, machine, operator, shift, progress %). "
                "Use when user asks about overall shop floor status, today's floor summary, "
                "how many operators are working, shop floor performance."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_attendance_deep",
            "description": (
                "Get comprehensive attendance information for the current operator — "
                "today's clock in/out, hours worked, status (present/absent/late), "
                "last 30 days: present days, absent days, late days, total hours, attendance %. "
                "Use when user asks about their attendance, how many days present, hours worked."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_overview_deep",
            "description": (
                "Get a full production overview with total orders, planned orders, in-progress orders, "
                "completed orders, pending orders, delayed orders, cancelled orders, and today's production output. "
                "Use when user asks: total orders, how many orders, completed orders, planned orders, "
                "pending orders, delayed orders, overall production status, todays production, today output."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_schedule_deep",
            "description": (
                "Get the complete production schedule with work orders, machine assignments, operator, shift, "
                "planned start/end times, days remaining, progress %, delay status. "
                "Use when user asks: production schedule, today schedule, machine schedule, who is on which machine, "
                "shift schedule, upcoming work orders, schedule overview, what is planned."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Optional filter: machine, product, operator, shift, status."}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_mrp_deep",
            "description": (
                "Get MRP (Material Requirements Planning) status — per production order: product, BOM components, "
                "required qty, available qty, shortage qty, purchase request raised, materials issued status. "
                "Use when user asks: MRP status, material requirements, material shortage, BOM materials, "
                "what materials are needed, which materials are short, purchase request for materials."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Optional filter: order number, product, status."}
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_assigned_tasks_deep",
            "description": (
                "Get all assigned tasks/work orders for operators — operator name, machine, product, shift, "
                "planned qty, progress, time remaining, delay status. "
                "Use when user asks: assigned tasks, who is assigned to what, my tasks, operator tasks, "
                "task assignment, who is doing what work, assign task status."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Optional filter: operator name, machine, product, status."}
                },
                "required": [],
            },
        },
    },    {
        "type": "function",
        "function": {
            "name": "get_product_detail_deep",
            "description": (
                "Get direct, complete details for a specific product: product ID, SKU, BOM raw materials "
                "with quantities and costs, machine, operator, supervisor, manpower, planned production time, "
                "average cycle time, and latest production/work order. Use whenever the user asks how long a "
                "product takes to make, which or how much raw material it uses, BOM, machine, manpower, or "
                "complete product production details."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "product_name": {
                        "type": "string",
                        "description": "Product name, SKU, or product code from the user's question.",
                    }
                },
                "required": ["product_name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_product_overview_deep",
            "description": (
                "Get full product overview: total products, today's products, per-product order status "
                "(planned, in-progress, completed, delayed, cancelled), today's production units. "
                "Use when user asks: total products, how many products, product status, today products, "
                "product wise orders, production by product."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_work_order_stats_deep",
            "description": (
                "Get complete work order statistics: total, today, planned, in-progress, completed, "
                "delayed, high-priority, paused, cancelled work orders with breakdown. "
                "Use when user asks: total work orders, work order stats, planned work orders, "
                "delayed work orders, high priority work orders, work order summary."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_production_schedule_stats_deep",
            "description": (
                "Get production schedule statistics: completed/pending/in-progress counts, "
                "machine utilization %, operator presence %, delayed orders, material shortage orders, "
                "production target vs actual, schedule list with machine/operator/shift/progress. "
                "Use when user asks: schedule stats, machine utilization, operator presence, "
                "production target, material shortage in schedule, schedule overview."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_machine_allocation_deep",
            "description": (
                "Get machine allocation: per-machine details with work order, product, machine, operator, "
                "shift, supervisor, capacity %, status. Summary: total machines, allocated, free, "
                "under maintenance, offline, utilization %. "
                "Use when user asks: machine allocation, which machine allocated, free machines, "
                "machine utilization, machine assignment, machine capacity."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_batch_summary_deep",
            "description": (
                "Get batch summary: total batches, running, completed, hold, rejected, expired counts "
                "with recent batch details including product, quantity, good qty, scrap, yield %. "
                "Use when user asks: total batches, batch summary, running batches, completed batches, "
                "batch status overview, how many batches, hold batches, rejected batches."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_machine_status_deep",
            "description": (
                "Get machine status overview: total machines, running, idle, maintenance, breakdown, offline "
                "counts and per-machine details with OEE, health score, today output, downtime, work order. "
                "Use when user asks: machine status, total machines, running machines count, idle machines, "
                "machines in maintenance, breakdown machines, offline machines, machine overview, machine health."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },

]

# Maps tool name → equivalent REST endpoint (for documentation / tracing)
API_ENDPOINT_MAP = {
    "get_todays_work_orders": "GET /api/workorders/today",
    "get_pending_work_orders": "GET /api/workorders",
    "get_assigned_work_orders": "GET /api/workorders/assigned",
    "get_work_order_by_number": "GET /api/workorders/{id}",
    "get_todays_production": "GET /api/dashboard/today",
    "get_machine_status": "GET /api/machines/status",
    "get_running_machines": "GET /api/machines/running",
    "get_production_schedule": "GET /api/schedule/today",
    "get_production_plan": "GET /api/production/plans/today",
    "get_batch_status": "GET /api/batches/running",
    "clock_in": "POST /api/operator/clockin",
    "clock_out": "POST /api/operator/clockout",
    "get_my_attendance": "GET /api/operator/attendance",
    "work_order_action": "POST /api/workorders/{action}",
    "update_production_progress": "POST /api/workorders/progress",
    "report_machine_breakdown": "POST /api/machines/breakdown",
    # Deep intelligence tools
    "get_machine_deep_status": "GET /api/machines/deep",
    "get_work_order_deep": "GET /api/workorders/deep",
    "get_batch_deep": "GET /api/batches/deep",
    "get_production_plan_deep": "GET /api/production/plans/deep",
    "get_shopfloor_deep": "GET /api/production/overview/deep",
    "get_attendance_deep": "GET /api/operator/attendance/deep",
    "get_production_overview_deep": "GET /api/production/overview/deep",
    "get_schedule_deep": "GET /api/production/schedule/deep",
    "get_mrp_deep": "GET /api/production/mrp/deep",
    "get_assigned_tasks_deep": "GET /api/production/tasks/deep",
    "get_product_detail_deep": "GET /api/products/{product}/deep",
}


def _safe_call(fn, *args, **kwargs) -> dict:
    try:
        result = fn(*args, **kwargs)
        return {"success": True, "data": result, "endpoint": None}
    except HTTPException as exc:
        return {"success": False, "error": exc.detail, "status_code": exc.status_code}
    except Exception as exc:
        logger.exception("Function registry call failed")
        return {"success": False, "error": str(exc)}


def execute_tool(db: Session, user: User, tool_name: str, arguments: dict) -> dict:
    """Execute a tool via OperatorService — same data layer as /api routes."""
    svc = OperatorService(db, user.tenant_id)
    endpoint = API_ENDPOINT_MAP.get(tool_name)
    args = arguments or {}
    
    if tool_name == "get_todays_work_orders":
        data = svc.list_today_work_orders(user)
        orders = data or []
        if not orders:
            fallback = svc.list_work_orders(user)
            orders = [
                w for w in fallback
                if isinstance(w, dict)
                and (
                    w.get("status") in (
                    "planned",
                    "pending",
                    "released",
                    "in_progress",
                    "running",
                    "paused",
                    )
                    or w.get("planned_start")
                    )
            ]
        for order in orders:
            if not isinstance(order, dict) or not order.get("id"):
                continue
            try:
                detail = svc.get_work_order(int(order["id"]), user)
                if isinstance(detail, dict):
                    order["raw_materials"] = detail.get("materials") or []
            except Exception:
                logger.debug("Could not enrich today's work order materials", exc_info=True)
        return {
            "success": True,
            "count": len(orders),
            "work_orders": orders,
            "endpoint": endpoint,
        }

    if tool_name == "get_pending_work_orders":
        data = svc.list_work_orders(user)
        filtered = [w for w in data if isinstance(w, dict) and w.get("status") in ("planned", "pending", "released")]
        return {"success": True, "count": len(filtered), "work_orders": filtered, "endpoint": endpoint}

    if tool_name == "get_assigned_work_orders":
        data = svc.list_assigned_work_orders(user)
        return {"success": True, "count": len(data), "work_orders": data, "endpoint": endpoint}

    if tool_name == "get_work_order_by_number":
        wo = svc.work_orders.get_by_number(args.get("work_order_number", ""), user=user)
        if not wo:
            return {"success": True, "found": False, "message": "Work order not found.", "endpoint": endpoint}
        detail = svc.get_work_order(wo.id, user)
        return {"success": True, "found": True, "work_order": detail, "endpoint": endpoint}

    if tool_name == "get_todays_production":
        from sqlalchemy import select
        from app.models.production import DailyProductionReport

        reports = list(
            svc.db.scalars(
                select(DailyProductionReport).where(
                    DailyProductionReport.tenant_id == svc.tenant_id,
                    DailyProductionReport.report_date == date.today(),
                )
            ).all()
        )
        completed = int(sum(float(r.produced_quantity or 0) for r in reports))
        target = int(sum(float(r.planned_quantity or 0) for r in reports))
        return {
            "success": True,
            "todays_target": target,
            "todays_production": completed,
            "endpoint": endpoint,
        }

    if tool_name == "get_machine_status":
        code = (args.get("machine_code") or "").strip()
        if code:
            machine = svc.machines.get_by_code(code)
            if not machine:
                return {"success": True, "found": False, "message": f"Machine {code} not found."}
            return {"success": True, "machines": [svc.get_machine(machine.id)], "endpoint": endpoint}
        machines = svc.list_machines()
        if not machines:
            machines = svc.get_machine_status_summary().get("machines", [])
        return {"success": True, "machines": machines, "endpoint": endpoint}

    if tool_name == "get_running_machines":
        machines = svc.list_running_machines()
        if not machines:
            machines = [m for m in svc.list_machines() if (m.get("status") or "").lower() in {"running", "in_progress", "active"}]
        return {"success": True, "machines": machines, "endpoint": endpoint}

    if tool_name == "get_production_schedule":
        return {"success": True, "schedule": svc.get_schedule_today(), "endpoint": endpoint}

    if tool_name == "get_production_plan":
        return {"success": True, "plans": svc.list_today_plans(), "endpoint": endpoint}

    if tool_name == "get_batch_status":
        return {
            "success": True,
            "running": svc.list_running_batches(),
            "completed": svc.list_completed_batches(),
            "endpoint": endpoint,
        }

    if tool_name == "get_batch_details":
        batches = svc.list_batches()
        code = (args.get("batch_number") or "").upper()
        match = next((b for b in batches if b.get("batch_code", "").upper() == code), None)
        if not match:
            return {"success": True, "found": False, "message": f"Batch {code} not found."}
        detail = svc.get_batch(match["id"])
        return {"success": True, "found": True, "batch": detail, "endpoint": endpoint}

    if tool_name == "clock_in":
        rec = svc.clock_in(user)
        return {"success": True, "attendance": rec.model_dump(), "endpoint": endpoint}

    if tool_name == "clock_out":
        rec = svc.clock_out(user)
        return {"success": True, "attendance": rec.model_dump(), "endpoint": endpoint}

    if tool_name == "get_my_attendance":
        return {"success": True, "attendance": svc.get_attendance(user), "endpoint": endpoint}

    if tool_name == "work_order_action":
        action = args.get("action", "start")
        payload = WorkOrderActionRequest(work_order_number=args.get("work_order_number"))
        handlers = {
            "start": svc.start_work_order,
            "pause": svc.pause_work_order,
            "resume": svc.resume_work_order,
            "complete": svc.complete_work_order,
        }
        handler = handlers.get(action)
        if not handler:
            return {"success": False, "error": f"Unknown action: {action}"}
        return _safe_call(handler, user, payload) | {"endpoint": endpoint}

    if tool_name == "update_production_progress":
        payload = WorkOrderProgressRequest(
            work_order_number=args.get("work_order_number"),
            produced_quantity=float(args.get("produced_quantity", 1)),
        )
        return _safe_call(svc.update_production_progress, user, payload) | {"endpoint": endpoint}

    if tool_name == "report_machine_breakdown":
        payload = MachineBreakdownRequest(
            machine_code=args.get("machine_code"),
            description=args.get("description", "Breakdown reported via AI assistant"),
        )
        return _safe_call(svc.report_breakdown, user, payload) | {"endpoint": endpoint}

    # ── Deep Intelligence Tools ──────────────────────────────────────────────

    if tool_name == "get_machine_deep_status":
        query = args.get("query", "")
        machines = svc.get_machine_deep_status(query)
        return {"success": True, "query": query, "machines": machines, "count": len(machines), "endpoint": endpoint}

    if tool_name == "get_work_order_deep":
        query = args.get("query", "")
        wos = svc.get_work_order_deep(query)
        return {"success": True, "work_orders": wos, "count": len(wos), "endpoint": endpoint}

    if tool_name == "get_batch_deep":
        query = args.get("query", "")
        batches = svc.get_batch_deep(query)
        return {"success": True, "batches": batches, "count": len(batches), "endpoint": endpoint}

    if tool_name == "get_production_plan_deep":
        query = args.get("query", "")
        plans = svc.get_production_plan_deep(query)
        return {"success": True, "plans": plans, "count": len(plans), "endpoint": endpoint}

    if tool_name == "get_shopfloor_deep":
        data = svc.get_shopfloor_deep()
        return {"success": True, **data, "endpoint": endpoint}

    if tool_name == "get_attendance_deep":
        data = svc.get_attendance_deep(user)
        return {"success": True, **data, "endpoint": endpoint}

    if tool_name == "get_production_overview_deep":
        data = svc.get_production_overview_deep(args.get("query", ""))
        return {"success": True, **data, "endpoint": endpoint}

    if tool_name == "get_schedule_deep":
        query = args.get("query", "")
        schedule = svc.get_schedule_deep(query)
        return {"success": True, "schedule": schedule, "count": len(schedule), "endpoint": endpoint}

    if tool_name == "get_mrp_deep":
        query = args.get("query", "")
        mrp = svc.get_mrp_deep(query)
        return {"success": True, "mrp": mrp, "count": len(mrp), "endpoint": endpoint}

    if tool_name == "get_assigned_tasks_deep":
        query = args.get("query", "")
        tasks = svc.get_assigned_tasks_deep(query, user)
        return {"success": True, "tasks": tasks, "count": len(tasks), "endpoint": endpoint}

    if tool_name == "get_product_overview_deep":
        return {"success": True, **svc.get_product_overview_deep(), "endpoint": endpoint}

    if tool_name == "get_product_detail_deep":
        data = svc.get_product_detail_deep(args.get("product_name", ""))
        return {"success": True, **data, "endpoint": endpoint}

    if tool_name == "get_work_order_stats_deep":
        return {
            "success": True,
            **svc.get_work_order_stats_deep(args.get("query", ""), user=user),
            "endpoint": endpoint,
        }

    if tool_name == "get_production_schedule_stats_deep":
        return {"success": True, **svc.get_production_schedule_stats_deep(), "endpoint": endpoint}

    if tool_name == "get_machine_allocation_deep":
        return {"success": True, **svc.get_machine_allocation_deep(), "endpoint": endpoint}

    if tool_name == "get_batch_summary_deep":
        return {"success": True, **svc.get_batch_summary_deep(), "endpoint": endpoint}

    if tool_name == "get_machine_status_deep":
        return {"success": True, **svc.get_machine_status_deep(), "endpoint": endpoint}

    return {"success": False, "error": f"Unknown tool: {tool_name}"}


def format_tool_result(tool_name: str, result: dict) -> str:
    if result.get("error") and not result.get("success"):
        return str(result["error"])
    if tool_name == "get_todays_work_orders":
        orders = result.get("work_orders") or []
        total = result.get("count", len(orders))
        planned = sum(1 for wo in orders if (wo.get("status") or "").lower() in {"planned", "pending", "released"})
        in_prog  = sum(1 for wo in orders if (wo.get("status") or "").lower() in {"in_progress", "running", "active"})
        completed = sum(1 for wo in orders if (wo.get("status") or "").lower() in {"completed", "done"})
        delayed  = sum(1 for wo in orders if (wo.get("status") or "").lower() in {"delayed", "hold", "on_hold"})
        lines = [
            f"### 📋 Today's Work Orders — {total} Total",
            "",
            "**📊 Summary**",
            f"- 📦 Total Work Orders: **{total}**",
            f"- 🔵 Planned:     **{planned}**",
            f"- 🟢 In Progress: **{in_prog}**",
            f"- ✅ Completed:  **{completed}**",
            f"- 🔴 Delayed:    **{delayed}**",
        ]
        if orders:
            lines += ["", "**📋 Work Order Details**"]
            for wo in orders[:15]:
                s = (wo.get("status") or "unknown").lower()
                icon = {
                    "in_progress": "🟢", "running": "🟢", "active": "🟢",
                    "planned": "🔵", "pending": "🔵", "released": "🔵",
                    "completed": "✅", "done": "✅",
                    "delayed": "🔴", "hold": "⏸️",
                }.get(s, "⚪")
                wo_no    = wo.get("work_order_number") or wo.get("number") or "?"
                product  = wo.get("product_name") or wo.get("product") or "—"
                machine  = wo.get("machine_code") or wo.get("machine") or "—"
                operator = wo.get("operator_name") or wo.get("operator") or "—"
                shift    = wo.get("shift") or "—"
                priority = (wo.get("priority") or "medium").upper()
                planned_q = float(wo.get("planned_quantity") or 0)
                actual_q  = float(wo.get("actual_quantity") or wo.get("produced_quantity") or 0)
                prog = round(actual_q / planned_q * 100, 1) if planned_q else 0
                bar  = "█" * int(prog // 20) + "░" * (5 - int(prog // 20))
                lines.append(
                    f"\n  {icon} **{wo_no}** — {product}"
                    f"\n  - **Machine:** {machine}  |  **Operator:** {operator}  |  **Shift:** {shift}  |  **Priority:** {priority}"
                    f"\n  - **Progress:** **{prog}%** {bar} ({actual_q:,.0f}/{planned_q:,.0f} units)"
                    f"\n  - **Status:** {s.upper()}"
                )
                materials = wo.get("raw_materials") or []
                if materials:
                    lines.append("  - **Raw Materials:** " + "; ".join(
                        f"{m.get('component_name', '—')} ({m.get('required_qty', 0)} {m.get('unit', '')}, issued {m.get('issued_qty', 0)})"
                        for m in materials
                    ))
                else:
                    lines.append("  - **Raw Materials:** No BOM materials configured")
        if delayed > 0:
            lines += ["", f"⚠️ **Alert:** {delayed} work order(s) are delayed — immediate attention required!"]
        return "\n".join(lines)
    if tool_name == "get_todays_production":
        target    = result.get("todays_target", 0)
        produced  = result.get("todays_production", 0)
        remaining = max(target - produced, 0)
        prog      = round(produced / target * 100, 1) if target else 0
        bar       = "█" * int(prog // 20) + "░" * (5 - int(prog // 20))
        status    = "✅ On Track" if prog >= 80 else ("⚠️ Behind Schedule" if prog >= 50 else "🔴 Critical")
        return (
            "### 🏭 Today's Production Summary\n"
            "\n**📊 Production Metrics**\n"
            f"- 🎯 **Target:**    **{target:,} units**\n"
            f"- 🟢 **Produced:**  **{produced:,} units**\n"
            f"- ⏳ **Remaining:** **{remaining:,} units**\n"
            f"- 📊 **Progress:**  **{prog}%** {bar}\n"
            f"- 📍 **Status:**    {status}\n"
        )
    if tool_name == "get_machine_status":
        machines = result.get("machines") or []
        total = len(machines)
        running = sum(1 for m in machines if (m.get("status") or "").lower() in {"running", "active", "working"})
        idle = sum(1 for m in machines if (m.get("status") or "").lower() in {"idle", "available"})
        breakdown = sum(1 for m in machines if (m.get("status") or "").lower() in {"breakdown", "down", "stopped"})
        maint = sum(1 for m in machines if (m.get("status") or "").lower() in {"maintenance", "maint"})
        offline = sum(1 for m in machines if (m.get("status") or "").lower() in {"offline", "inactive"})
        lines = [
            f"### 🏭 Machine Status Report — {total} Machines",
            "",
            "**📊 Fleet Summary**",
            f"- 🏭 Total Machines: **{total}**",
            f"- 🟢 Running:      **{running}**",
            f"- 🟡 Idle:          **{idle}**",
            f"- 🔧 Maintenance:  **{maint}**",
            f"- 🔴 Breakdown:    **{breakdown}**",
            f"- ⚫ Offline:      **{offline}**",
        ]
        if machines:
            lines += ["", "**🔧 Machine Details**"]
            for m in machines[:20]:
                s = (m.get("status") or "unknown").lower()
                icon = {
                    "running": "🟢", "active": "🟢", "working": "🟢",
                    "idle": "🟡", "available": "🟡",
                    "maintenance": "🔧", "maint": "🔧",
                    "breakdown": "🔴", "down": "🔴",
                    "offline": "⚫", "inactive": "⚫",
                }.get(s, "⚪")
                code = m.get("code") or m.get("machine_code") or "?"
                name = m.get("name") or m.get("machine_name") or ""
                mtype = m.get("machine_type") or m.get("type") or "—"
                loc   = m.get("location") or "—"
                lines.append(f"  {icon} **{code}** {name}  |  Type: {mtype}  |  Location: {loc}  |  Status: **{s.upper()}**")
        if breakdown > 0:
            lines += ["", f"🔴 **Alert:** {breakdown} machine(s) in breakdown — raise maintenance request immediately!"]
        elif maint > 0:
            lines += ["", f"🔧 **Note:** {maint} machine(s) under scheduled maintenance."]
        return "\n".join(lines)
    if tool_name == "get_running_machines":
        machines = result.get("machines") or []
        if not machines:
            return "No machines are currently running."
        lines = ["**Running Machines**\n"]
        for m in machines[:10]:
            code = m.get("code") or m.get("machine_code") or "N/A"
            name = m.get("name") or m.get("machine_name") or ""
            line = f"- **{code}**"
            if name:
                line += f" {name}"
            lines.append(line)
        return "\n".join(lines)
    if tool_name == "get_batch_status":
        running = result.get("running") or []
        completed = result.get("completed") or []
        lines = ["**Batch Tracking**"]
        lines.append(f"- Total: **{len(running) + len(completed)}**")
        lines.append(f"- In Progress: **{len(running)}**")
        lines.append(f"- Completed: **{len(completed)}**")
        lines.append(f"- Delayed: **0**")
        lines.append(f"- Yield: **{round((sum(float(b.get('quantity') or 0) for b in completed) / max(sum(float(b.get('quantity') or 0) for b in running + completed), 1)) * 100, 1) if (running or completed) else 0}%**")
        return "\n".join(lines)
    if tool_name == "get_batch_details":
        batch = result.get("batch") or {}
        if not batch:
            return "No batch details available."
        qty = batch.get("quantity") or 0
        good = batch.get("good_qty") or 0
        scrap = batch.get("scrap_qty") or 0
        yield_pct = round((good / qty * 100) if qty else 0, 1)
        return (
            "**Batch Details**\n"
            f"- Batch: **{batch.get('batch_code') or 'N/A'}**\n"
            f"- Status: **{batch.get('status') or 'Unknown'}**\n"
            f"- Quantity: **{qty}**\n"
            f"- Good Qty: **{good}**\n"
            f"- Scrap Qty: **{scrap}**\n"
            f"- Yield: **{yield_pct}%**"
        )
    if tool_name == "get_my_attendance":
        attendance = result.get("attendance") or {}
        if isinstance(attendance, dict):
            return (
                "**HR Attendance**\n"
                f"- Present: **{attendance.get('present', 0)}**\n"
                f"- Absent: **{attendance.get('absent', 0)}**\n"
                f"- On Duty: **{attendance.get('on_duty', 0)}**\n"
                f"- Late/OT: **{attendance.get('late_or_ot', 0)}**"
            )
        return "**HR Attendance**\n- Present: **0**\n- Absent: **0**\n- On Duty: **0**\n- Late/OT: **0**"
    if tool_name in ("clock_in", "clock_out"):
        return f"**{tool_name.replace('_', ' ').title()}** recorded successfully."

    # ── Deep Intelligence Formatters ─────────────────────────────────────────

    if tool_name == "get_machine_deep_status":
        machines = result.get("machines") or []
        if not machines:
            query = result.get("query") or "the requested status"
            return f"No machines currently match **{query}**. The live machine data contains no machines in that status."
        lines = [f"### 🏭 Machine Deep Status Report  ({len(machines)} machine{'s' if len(machines) != 1 else ''})", ""]
        for m in machines:
            wo = m.get("current_work_order") or {}
            prod = m.get("product") or {}
            mp = m.get("manpower") or {}
            status_icon = {"running": "🟢", "idle": "🟡", "breakdown": "🔴", "maintenance": "🔧"}.get((m.get("status") or "").lower(), "⚪")
            lines += [
                f"---",
                f"**{status_icon} {m.get('machine_code','?')} — {m.get('machine_name','?')}**",
                f"- **Status:** {(m.get('status') or 'unknown').upper()}  |  **Type:** {m.get('machine_type') or '—'}  |  **Location:** {m.get('location') or '—'}  |  **Dept:** {m.get('department') or '—'}",
            ]
            if prod.get("name"):
                lines += [
                    "",
                    f"**📦 Product Being Made**",
                    f"- **Product:** {prod.get('name','—')}  |  **SKU:** {prod.get('sku','—')}",
                    f"- **Work Order:** {wo.get('work_order_number','—')}  |  **Production Order:** {prod.get('production_order','—')}",
                    f"- **Customer:** {prod.get('customer','—')}  |  **Sales Order:** {prod.get('sales_order','—')}  |  **BOM:** {prod.get('bom_version','—')}",
                    f"- **Priority:** {(wo.get('priority') or 'medium').upper()}  |  **Shift:** {wo.get('shift') or '—'}  |  **Dept:** {wo.get('department') or '—'}",
                ]
                lines += [
                    "",
                    f"**👷 Manpower**",
                    f"- **Operator:** {mp.get('operator_name') or m.get('assigned_operator') or '—'}",
                    f"- **Supervisor:** {mp.get('supervisor') or '—'}",
                    f"- **Current Shift:** {mp.get('shift') or m.get('current_shift') or '—'}",
                ]
                planned = wo.get('planned_quantity', 0)
                produced = wo.get('produced_quantity', 0)
                remaining = wo.get('remaining_quantity', 0)
                progress = wo.get('progress_pct', 0)
                scrap = wo.get('scrap_quantity', 0)
                good = wo.get('good_quantity', 0)
                scrap_pct = wo.get('scrap_pct', 0)
                yield_pct = wo.get('yield_pct', 0)
                lines += [
                    "",
                    f"**📊 Production Progress**",
                    f"- **Planned Qty:** {planned:,.0f} units",
                    f"- **Produced:**    {produced:,.0f} units  ({progress}%)",
                    f"- **Remaining:**   {remaining:,.0f} units",
                    f"- **Good Qty:**    {good:,.1f} units  |  **Yield:** {yield_pct}%",
                    f"- **Scrap:**       {scrap:,.1f} units  ({scrap_pct}%)",
                    f"- **Materials Issued:** {'✅ Yes' if wo.get('materials_issued') else '❌ No'}",
                ]
                hrs = wo.get('hours_remaining')
                days = wo.get('days_remaining')
                delayed = wo.get('is_delayed', False)
                time_left_str = f"{hrs} hrs  (~{days} days)" if hrs is not None else 'Not scheduled'
                lines += [
                    "",
                    f"**⏱ Time Analysis**",
                    f"- **Started:**      {(wo.get('planned_start') or '—')[:16]}",
                    f"- **Planned End:**  {(wo.get('planned_end') or '—')[:16]}",
                    f"- **Time Left:**    {time_left_str}",
                    f"- **Status:**       {'🔴 DELAYED' if delayed else '✅ On Track'}",
                    f"- **Downtime:**     {wo.get('downtime_minutes', 0)} min",
                ]
            lines += [
                "",
                f"**⚙️ Machine Performance**",
                f"- **OEE:** {m.get('oee_pct') or '—'}%  |  **Efficiency:** {m.get('efficiency_pct') or '—'}%",
                f"- **Health Score:** {m.get('health_score') or '—'}/100",
                f"- **Temperature:** {m.get('temperature_c') or '—'}°C  |  **RPM:** {m.get('rpm') or '—'}",
                f"- **Last Maintenance:** {m.get('last_maintenance') or '—'}",
                f"- **Next Maintenance:** {m.get('next_maintenance') or '—'}",
            ]
        return "\n".join(lines)

    if tool_name == "get_work_order_deep":
        wos = result.get("work_orders") or []
        if not wos:
            return "No work orders found matching your query."
        lines = [f"### 📋 Work Order Deep Report  ({len(wos)} order{'s' if len(wos) != 1 else ''})", ""]
        for wo in wos[:8]:
            prod = wo.get("product") or {}
            mac = wo.get("machine") or {}
            status_icon = {"running": "🟢", "in_progress": "🟢", "planned": "🔵", "completed": "✅", "paused": "⏸️", "delayed": "🔴"}.get((wo.get("status") or "").lower(), "⚪")
            hrs_rem = wo.get('hours_remaining')
            days_rem = wo.get('days_remaining')
            time_rem_str = f"{hrs_rem} hrs (~{days_rem} days)" if hrs_rem is not None else 'Not scheduled'
            lines += [
                "---",
                f"**{status_icon} {wo.get('work_order_number','?')}**  |  Status: **{(wo.get('status') or '').upper()}**  |  Priority: **{(wo.get('priority') or 'medium').upper()}**",
                f"- **Product:** {prod.get('name','—')}  |  **Customer:** {prod.get('customer','—')}  |  **Production Order:** {prod.get('production_order','—')}",
                f"- **Machine:** {mac.get('code','—')} {mac.get('name','—')}  |  **OEE:** {mac.get('oee_pct') or '—'}%",
                f"- **Operator:** {wo.get('operator_name') or '—'}  |  **Supervisor:** {wo.get('supervisor') or '—'}  |  **Shift:** {wo.get('shift') or '—'}  |  **Dept:** {wo.get('department') or '—'}",
                "",
                f"**📊 Progress**",
                f"- Planned: {wo.get('planned_quantity',0):,.0f}  |  Produced: {wo.get('produced_quantity',0):,.0f}  |  Remaining: {wo.get('remaining_quantity',0):,.0f}  ({wo.get('progress_pct',0)}%)",
                f"- Good: {wo.get('good_quantity',0):,.1f}  |  Scrap: {wo.get('scrap_quantity',0):,.1f} ({wo.get('scrap_pct',0)}%)  |  Downtime: {wo.get('downtime_minutes',0)} min",
                f"- Materials Issued: {'✅ Yes' if wo.get('materials_issued') else '❌ No'}",
                "",
                f"**⏱ Timeline**",
                f"- Start: {(wo.get('planned_start') or '—')[:16]}  →  End: {(wo.get('planned_end') or '—')[:16]}",
                f"- Time Remaining: {time_rem_str}",
                f"- Delay: {'🔴 YES — OVERDUE' if wo.get('is_delayed') else '✅ On Track'}",
                "",
            ]
        return "\n".join(lines)

    if tool_name == "get_batch_deep":
        batches = result.get("batches") or []
        if not batches:
            return "No batches found matching your query."
        lines = [f"### 📦 Batch Deep Report  ({len(batches)} batch{'es' if len(batches) != 1 else ''})", ""]
        for b in batches[:8]:
            prod = b.get("product") or {}
            status_icon = {"completed": "✅", "in_process": "🔄", "running": "🟢", "hold": "⏸️", "rejected": "❌"}.get((b.get("status") or "").lower(), "⚪")
            lines += [
                "---",
                f"**{status_icon} Batch: {b.get('batch_code','?')}**  |  Status: **{(b.get('status') or '').upper()}**",
                f"- **Product:** {prod.get('name','—')}  |  **SKU:** {prod.get('sku','—')}  |  **Customer:** {prod.get('customer','—')}",
                f"- **Production Order:** {prod.get('production_order','—')}  |  **Work Order:** {b.get('work_order','—')}",
                f"- **Machine:** {b.get('machine_code','—')} {b.get('machine','—')}",
                f"- **Operator:** {b.get('operator','—')}  |  **Supervisor:** {b.get('supervisor','—')}  |  **Shift:** {b.get('shift','—')}",
                "",
                f"**📊 Quality & Quantity**",
                f"- Total Qty: **{b.get('quantity',0):,.1f}**  |  Good: **{b.get('good_quantity',0):,.1f}**  |  Scrap: **{b.get('scrap_quantity',0):,.1f}**",
                f"- Yield: **{b.get('yield_pct',0)}%**  |  QC Status: **{b.get('qc_status','pending').upper()}**  |  Dispatch: **{b.get('dispatch_status','pending').upper()}**",
                f"- Material Lot: **{b.get('material_lot','—')}**  |  Produced At: {b.get('produced_at','—')}",
                "",
                f"**🔍 Traceability**",
            ] + [f"  {i+1}. {step}" for i, step in enumerate(b.get("traceability") or [])] + [""]
        return "\n".join(lines)

    if tool_name == "get_production_plan_deep":
        plans = result.get("plans") or []
        if not plans:
            return "No production plans found matching your query."
        lines = [f"### 🏗️ Production Plan Deep Report  ({len(plans)} order{'s' if len(plans) != 1 else ''})", ""]
        for p in plans[:6]:
            prod = p.get("product") or {}
            mac = p.get("machine") or {}
            wo_info = p.get("work_orders") or {}
            status_icon = {"completed": "✅", "in_progress": "🟢", "running": "🟢", "planned": "🔵", "delayed": "🔴"}.get((p.get("status") or "").lower(), "⚪")
            hrs_rem = p.get('hours_remaining')
            days_rem = p.get('days_remaining')
            time_left_str = f"{hrs_rem} hrs (~{days_rem} days)" if hrs_rem is not None else 'No due date set'
            lines += [
                "---",
                f"**{status_icon} {p.get('order_number','?')}**  |  Status: **{(p.get('status') or '').upper()}**  |  Priority: **{(p.get('priority') or 'medium').upper()}**",
                f"- **Product:** {prod.get('name','—')}  |  **SKU:** {prod.get('sku','—')}",
                f"- **Customer:** {p.get('customer','—')}  |  **Sales Order:** {p.get('sales_order','—')}",
                f"- **Machine:** {mac.get('code','—')} {mac.get('name','—')}  |  **Status:** {mac.get('status','—')}",
                f"- **Dept:** {p.get('department','—')}  |  **Shift:** {p.get('shift','—')}  |  **BOM:** {p.get('bom_version','—')}",
                "",
                f"**📊 Progress**",
                f"- Planned: {p.get('planned_quantity',0):,.0f}  |  Produced: {p.get('produced_quantity',0):,.0f}  |  Remaining: {p.get('remaining_quantity',0):,.0f}  ({p.get('progress_pct',0)}%)",
                f"- Work Orders — Total: {wo_info.get('total',0)}  |  Running: {wo_info.get('running',0)}  |  Completed: {wo_info.get('completed',0)}  |  Pending: {wo_info.get('pending',0)}",
                "",
                f"**⏱ Timeline**",
                f"- Start: {(p.get('start_date') or '—')[:16]}  →  Due: {(p.get('due_date') or '—')[:16]}",
                f"- Time Left: {time_left_str}",
                f"- Delay: {'🔴 OVERDUE' if p.get('is_delayed') else '✅ On Track'}",
                "",
            ]
        return "\n".join(lines)

    if tool_name == "get_shopfloor_deep":
        mach = result.get("machines") or {}
        prod = result.get("production") or {}
        jobs = result.get("running_jobs_detail") or []
        alerts = result.get("alerts") or []
        lines = [
            f"### 🏭 Shop Floor Live Snapshot  —  {result.get('date','Today')}",
            "",
            f"**🔧 Machines**",
            f"- Total: **{mach.get('total',0)}**  |  🟢 Running: **{mach.get('running',0)}**  |  🟡 Idle: **{mach.get('idle',0)}**  |  🔴 Breakdown: **{mach.get('breakdown',0)}**",
            f"- Machine Utilization: **{mach.get('utilization_pct',0)}%**",
            "",
            f"**📊 Today's Production**",
            f"- Output: **{prod.get('todays_output',0):,} units**  |  Scrap: **{prod.get('todays_scrap',0)} units**  |  Downtime: **{prod.get('todays_downtime_minutes',0)} min**",
            f"- Running Jobs: **{prod.get('running_jobs',0)}**  |  Operators Working: **{prod.get('operators_working',0)}**",
        ]
        if jobs:
            lines += ["", f"**👷 Active Jobs**"]
            for j in jobs:
                lines.append(
                    f"- {j.get('work_order','?')} | {j.get('product','—')} | Machine: {j.get('machine','—')} "
                    f"| Op: {j.get('operator','—')} | Shift: {j.get('shift','—')} "
                    f"| Progress: {j.get('progress_pct',0)}% ({j.get('produced',0):,.0f}/{j.get('planned',0):,.0f})"
                )
        if alerts:
            lines += ["", f"**🚨 Active Alerts**"]
            for a in alerts:
                lines.append(f"- ⚠️ {a}")
        return "\n".join(lines)

    if tool_name == "get_attendance_deep":
        today = result.get("today") or {}
        last30 = result.get("last_30_days") or {}
        return "\n".join([
            f"### 👤 Attendance Report — {result.get('operator_name','You')}",
            "",
            f"**📅 Today**",
            f"- Status: **{today.get('status','Not clocked in').upper()}**",
            f"- Clock In:  {today.get('clock_in') or '—'}",
            f"- Clock Out: {today.get('clock_out') or '—'}",
            f"- Hours Worked: **{today.get('hours_worked', 0)} hrs**",
            "",
            f"**📆 Last 30 Days**",
            f"- ✅ Present:  **{last30.get('present',0)} days**",
            f"- ❌ Absent:   **{last30.get('absent',0)} days**",
            f"- ⏰ Late:     **{last30.get('late',0)} days**",
            f"- ⌚ Total Hours Worked: **{last30.get('total_hours_worked',0)} hrs**",
            f"- 📊 Attendance Rate: **{last30.get('attendance_pct',0)}%**",
            "",
            f"- Matched Employee: {result.get('matched_employee_name') or 'Not linked'} ({result.get('matched_employee_code') or '—'})",
            f"- Assigned Machine ID: {result.get('assigned_machine') or '—'}",
            f"- Plant Code: {result.get('plant_code') or '—'}",
        ])

    if tool_name == "get_production_overview_deep":
        s = result.get("summary") or {}
        today = result.get("today") or {}
        orders = result.get("orders") or result.get("active_orders") or []
        lines = [
            "### 🏭 Production Overview",
            "",
            "**📊 Order Summary**",
            f"- 📦 Total Orders:     **{s.get('total_orders', 0)}**",
            f"- 🔵 Planned:          **{s.get('planned', 0)}**",
            f"- 🟢 In Progress:      **{s.get('in_progress', 0)}**",
            f"- ✅ Completed:        **{s.get('completed', 0)}**",
            f"- ⏳ Pending:          **{s.get('pending', 0)}**",
            f"- 🔴 Delayed:          **{s.get('delayed', 0)}**",
            f"- ❌ Cancelled:        **{s.get('cancelled', 0)}**",
            "",
            f"**📅 Today's Production  ({today.get('date', 'Today')})**",
            f"- Output: **{today.get('output', 0):,.0f} units**  |  Scrap: **{today.get('scrap', 0):,.1f} units**",
        ]
        if orders:
            lines += ["", "**📋 Complete Order Details**"]
            for o in orders:
                delayed_icon = " 🔴 DELAYED" if o.get("is_delayed") else ""
                lines.append(
                    f"\n- **{o.get('order_number','?')}** (Production ID: {o.get('production_order_id','—')}) | "
                    f"{o.get('product','—')} (Product ID: {o.get('product_id','—')}) | "
                    f"Status: {(o.get('status') or 'unknown').upper()} | Progress: {o.get('progress_pct',0)}% "
                    f"({o.get('produced_qty',0):,.0f}/{o.get('planned_qty',0):,.0f}) | Due: {o.get('due_date','—')}{delayed_icon}"
                )
                lines.append(
                    f"  - Customer: {o.get('customer','—')} | Priority: {(o.get('priority','medium')).upper()} | "
                    f"Manpower: {o.get('manpower_count',0)} ({', '.join(o.get('manpower') or []) or 'Unassigned'})"
                )
                materials = o.get("raw_materials") or []
                lines.append(f"  - Raw Materials: {len(materials)} component(s)")
                for material in materials:
                    lines.append(
                        f"    - {material.get('component_name','—')} (Product ID: {material.get('component_product_id','—')}): "
                        f"required {material.get('required_qty',0)} {material.get('unit','')} | "
                        f"available {material.get('available_qty',0)} | shortage {material.get('shortage_qty',0)}"
                    )
                for wo in o.get("work_orders") or []:
                    lines.append(
                        f"  - Work Order ID: {wo.get('work_order_id','—')} / {wo.get('work_order_number','—')} | "
                        f"Machine: {wo.get('machine_id','—')} {wo.get('machine_name') or ''} | "
                        f"Operator: {wo.get('operator') or 'Unassigned'} | Supervisor: {wo.get('supervisor') or '—'} | "
                        f"Time taken: {wo.get('time_taken_hours') if wo.get('time_taken_hours') is not None else '—'} hrs | "
                        f"Planned time: {wo.get('planned_hours') if wo.get('planned_hours') is not None else '—'} hrs"
                    )
        return "\n".join(lines)

    if tool_name == "get_schedule_deep":
        sched = result.get("schedule") or []
        if not sched:
            return "No production schedule found. No work orders are currently scheduled."
        lines = [f"### 📅 Production Schedule  ({len(sched)} work order{'s' if len(sched) != 1 else ''})", ""]
        for s in sched:
            status_icon = {"running": "🟢", "in_progress": "🟢", "planned": "🔵",
                           "completed": "✅", "paused": "⏸️", "delayed": "🔴"}.get((s.get("status") or "").lower(), "⚪")
            hrs_rem = s.get('hours_remaining')
            days_rem = s.get('days_remaining')
            time_left_str = f"{hrs_rem} hrs (~{days_rem} days)" if hrs_rem is not None else 'Not scheduled'
            lines += [
                "---",
                f"**{status_icon} {s.get('work_order_number','?')}**  |  Status: **{(s.get('status') or '').upper()}**  |  Priority: **{(s.get('priority','medium')).upper()}**",
                f"- **Product:** {s.get('product','—')}  |  **Customer:** {s.get('customer','—')}  |  **Production Order:** {s.get('production_order','—')}",
                f"- **Machine:** {s.get('machine_code','—')} {s.get('machine_name','')}  |  **Operator:** {s.get('operator','—')}",
                f"- **Shift:** {s.get('shift','—')}  |  **Dept:** {s.get('department','—')}",
                f"- **Start:** {s.get('planned_start','—')}  →  **End:** {s.get('planned_end','—')}",
                f"- **Time Left:** {time_left_str}",
                f"- **Progress:** {s.get('produced_quantity',0):,.0f} / {s.get('planned_quantity',0):,.0f} units  ({s.get('progress_pct',0)}%)",
                f"- **Delay:** {'🔴 OVERDUE' if s.get('is_delayed') else '✅ On Track'}",
                "",
            ]
        return "\n".join(lines)

    if tool_name == "get_product_detail_deep":
        products = result.get("products") or []
        if not result.get("found") or not products:
            return result.get("message") or "No matching product found."
        lines = [f"### 📦 Product Production Details ({len(products)} match{'es' if len(products) != 1 else ''})", ""]
        for product in products:
            time_data = product.get("time_estimate") or {}
            manpower = product.get("manpower") or {}
            machine = product.get("machine") or {}
            order = product.get("latest_production_order") or {}
            lines += [
                "---",
                f"**📦 {product.get('product_name', '—')}** | Product ID: **{product.get('product_id', '—')}** | SKU: **{product.get('sku', '—')}**",
                f"- **Description:** {product.get('description') or '—'}",
                f"- **Production Time:** **{time_data.get('planned_hours') if time_data.get('planned_hours') is not None else 'Not configured'} hours** "
                f"({time_data.get('planned_days') if time_data.get('planned_days') is not None else '—'} days)",
                f"- **Average Cycle Time:** **{time_data.get('avg_cycle_time_min_per_unit') if time_data.get('avg_cycle_time_min_per_unit') is not None else 'Not available'} minutes/unit**",
                f"- **Machine:** {machine.get('name') or 'Not assigned'} (ID: {machine.get('id', '—')}, Code: {machine.get('code') or '—'})",
                f"- **Manpower:** Operator: {manpower.get('operator_name') or 'Unassigned'} | Supervisor: {manpower.get('supervisor') or '—'} | Shift: {manpower.get('shift') or '—'}",
                f"- **Latest Production Order:** {order.get('order_number') or 'None'} | Status: {order.get('status') or '—'} | Planned Qty: {order.get('planned_quantity') or '—'}",
                "",
                f"**🔩 Raw Materials ({len(product.get('raw_materials') or [])} components)**",
            ]
            materials = product.get("raw_materials") or []
            if not materials:
                lines.append("- No BOM raw materials configured for this product.")
            for material in materials:
                lines.append(
                    f"- **{material.get('component_name') or '—'}** | Product ID: {material.get('component_product_id', '—')} | "
                    f"Used: **{material.get('quantity', 0)} {material.get('unit') or ''} per product unit** | "
                    f"Unit cost: {material.get('unit_cost', 0):,.2f} | Component cost: {material.get('total_cost', 0):,.2f}"
                )
            lines.append("")
        return "\n".join(lines)

    if tool_name == "get_mrp_deep":
        mrp_list = result.get("mrp") or []
        if not mrp_list:
            return "No active production orders found for MRP analysis."
        lines = [f"### 🔩 MRP Material Requirements  ({len(mrp_list)} order{'s' if len(mrp_list) != 1 else ''})", ""]
        for m in mrp_list:
            all_ok = m.get("all_ok", True)
            lines += [
                "---",
                f"**📋 {m.get('order_number','?')}**  |  {m.get('product','—')}  |  Customer: {m.get('customer','—')}",
                f"- Status: **{(m.get('status') or '').upper()}**  |  Priority: **{(m.get('priority','medium')).upper()}**  |  Planned Qty: **{m.get('planned_quantity',0):,.0f}**  |  Due: **{m.get('due_date','—')}**",
                f"- Materials Issued: **{'✅ Yes' if m.get('materials_issued') else '❌ No'}**  |  Material Status: **{m.get('material_status','—')}**",
                "",
                f"**🧩 BOM Components ({m.get('total_components',0)} total)**",
            ]
            for c in (m.get("components") or []):
                ok_icon = "✅" if c.get("ok") else "❌"
                lines.append(
                    f"  {ok_icon} **{c.get('name','?')}** ({c.get('sku','—')}) | "
                    f"Required: {c.get('required',0):,.2f} {c.get('unit','')} | "
                    f"Available: {c.get('available',0):,.2f} | "
                    f"Shortage: {c.get('shortage',0):,.2f}"
                )
            lines.append("")
        return "\n".join(lines)

    if tool_name == "get_assigned_tasks_deep":
        tasks = result.get("tasks") or []
        if not tasks:
            return "No assigned tasks found."
        lines = [f"### 👷 Assigned Tasks  ({len(tasks)} work order{'s' if len(tasks) != 1 else ''})", ""]
        for t in tasks:
            status_icon = {"running": "🟢", "in_progress": "🟢", "planned": "🔵",
                           "completed": "✅", "paused": "⏸️"}.get((t.get("status") or "").lower(), "⚪")
            hrs = t.get('hours_remaining')
            days = t.get('days_remaining')
            time_left_str = f"{hrs} hrs (~{days} days)" if hrs is not None else 'Not scheduled'
            lines += [
                "---",
                f"**{status_icon} {t.get('work_order_number','?')}**  |  Status: **{(t.get('status') or '').upper()}**  |  Priority: **{(t.get('priority','medium')).upper()}**",
                f"- **Product:** {t.get('product','—')}  |  **Customer:** {t.get('customer','—')}  |  **Prod Order:** {t.get('production_order','—')}",
                f"- **Assigned To:** {t.get('assigned_operator','Unassigned')}  |  **Machine:** {t.get('machine_code','—')} {t.get('machine_name','')}",
                f"- **Shift:** {t.get('shift','—')}  |  **Dept:** {t.get('department','—')}",
                "",
                f"**📊 Progress**",
                f"- Planned: {t.get('planned_quantity',0):,.0f}  |  Done: {t.get('produced_quantity',0):,.0f}  |  Left: {t.get('remaining_quantity',0):,.0f}  ({t.get('progress_pct',0)}%)",
                f"- Materials Issued: {'✅ Yes' if t.get('materials_issued') else '❌ No'}",
                "",
                f"**⏱ Timeline**",
                f"- Start: {t.get('planned_start','—')}  →  End: {t.get('planned_end','—')}",
                f"- Time Left: {time_left_str}",
                f"- Delay: {'🔴 OVERDUE' if t.get('is_delayed') else '✅ On Track'}",
                "",
            ]
        return "\n".join(lines)

    if tool_name == "get_product_overview_deep":
        s = result.get("summary") or {}
        products = result.get("products") or []
        lines = [
            "### 🏷️ Product Overview",
            "",
            "**📊 Summary**",
            f"- 📦 Total Products:        **{s.get('total_products', 0)}**",
            f"- 🏭 Products Produced Today: **{s.get('products_produced_today', 0)}**",
            f"- 📈 Today's Output:         **{s.get('today_output_units', 0):,.0f} units**",
            f"- 🔵 Total Planned Orders:   **{s.get('total_planned_orders', 0)}**",
            f"- 🟢 In Progress:            **{s.get('total_in_progress', 0)}**",
            f"- ✅ Completed:              **{s.get('total_completed', 0)}**",
            f"- 🔴 Delayed:               **{s.get('total_delayed', 0)}**",
            f"- ❌ Cancelled:              **{s.get('total_cancelled', 0)}**",
        ]
        if products:
            lines += ["", "**📋 Per-Product Breakdown**"]
            for p in products[:10]:
                icon = "🟢" if p.get("in_progress") else ("✅" if p.get("completed") else "🔵")
                lines.append(
                    f"- {icon} **{p.get('product_name','?')}** (SKU: {p.get('sku','—')}) | "
                    f"Orders: {p.get('total_orders',0)} | Planned: {p.get('planned',0)} | "
                    f"Running: {p.get('in_progress',0)} | Done: {p.get('completed',0)} | "
                    f"Delayed: {p.get('delayed',0)} | Total Produced: {p.get('total_produced_qty',0):,.0f}"
                )
        return "\n".join(lines)

    if tool_name == "get_work_order_stats_deep":
        s = result.get("summary") or {}
        active = result.get("active_work_orders") or []
        lines = [
            "### 📋 Work Order Statistics",
            "",
            "**📊 Summary**",
            f"- 📦 Total Work Orders:  **{s.get('total_work_orders', 0)}**",
            f"- 📅 Today's WOs:        **{s.get('today_work_orders', 0)}**",
            f"- 🔵 Planned:            **{s.get('planned', 0)}**",
            f"- 🟢 In Progress:        **{s.get('in_progress', 0)}**",
            f"- ✅ Completed:          **{s.get('completed', 0)}**",
            f"- 🔴 Delayed:            **{s.get('delayed', 0)}**",
            f"- ⚡ High Priority:      **{s.get('high_priority', 0)}**",
            f"- ⏸️ Paused:             **{s.get('paused', 0)}**",
            f"- ❌ Cancelled:          **{s.get('cancelled', 0)}**",
        ]
        if active:
            lines += ["", "**🔄 Active Work Orders**"]
            for w in active:
                delay_tag = " 🔴 DELAYED" if w.get("is_delayed") else ""
                lines.append(
                    f"- **{w.get('work_order_number','?')}** | {w.get('product','—')} | "
                    f"Machine: {w.get('machine','—')} | Op: {w.get('operator','—')} | "
                    f"Shift: {w.get('shift','—')} | Priority: {(w.get('priority','medium')).upper()} | "
                    f"Progress: {w.get('progress_pct',0)}%{delay_tag}"
                )
        return "\n".join(lines)

    if tool_name == "get_production_schedule_stats_deep":
        s = result.get("summary") or {}
        mu = result.get("machine_utilization") or {}
        op = result.get("operator_presence") or {}
        ms = result.get("material_shortage") or {}
        pt = result.get("production_target") or {}
        schedule = result.get("schedule") or []
        lines = [
            "### 📅 Production Schedule Statistics",
            "",
            "**📊 Schedule Summary**",
            f"- 📋 Total Scheduled: **{s.get('total_scheduled',0)}**  | ✅ Completed: **{s.get('completed',0)}** | ⏳ Pending: **{s.get('pending',0)}** | 🟢 In Progress: **{s.get('in_progress',0)}** | 🔴 Delayed: **{s.get('delayed',0)}**",
            "",
            "**⚙️ Machine Utilization**",
            f"- Total Machines: **{mu.get('total_machines',0)}** | Active: **{mu.get('active_machines',0)}** | Utilization: **{mu.get('utilization_pct',0)}%**",
            "",
            "**👷 Operator Presence**",
            f"- Total Operators: **{op.get('total_operators',0)}** | On Floor: **{op.get('operators_on_floor',0)}** | Presence: **{op.get('presence_pct',0)}%**",
            "",
            "**🔩 Material Shortage**",
            f"- Orders with Shortage: **{ms.get('orders_with_shortage',0)}**",
        ]
        for d in (ms.get("details") or []):
            lines.append(f"  - {d.get('order','?')}: {d.get('shortage_items',0)} component(s) short")
        lines += [
            "",
            "**🎯 Production Target (Today)**",
            f"- Date: **{pt.get('today_date','—')}** | Target: **{pt.get('today_target',0):,.0f}** | Output: **{pt.get('today_output',0):,.0f}** | Scrap: **{pt.get('today_scrap',0):,.1f}** | Achievement: **{pt.get('achievement_pct',0)}%**",
        ]
        if schedule:
            lines += ["", "**📋 Schedule Breakdown**"]
            for row in schedule[:10]:
                delay_tag = " 🔴" if row.get("is_delayed") else " ✅"
                lines.append(
                    f"- **{row.get('work_order','?')}** | {row.get('product','—')} | Machine: {row.get('machine','—')} | "
                    f"Op: {row.get('operator','—')} | Shift: {row.get('shift','—')} | "
                    f"Status: {(row.get('status') or '').upper()} | {row.get('progress_pct',0)}%{delay_tag}"
                )
        return "\n".join(lines)

    if tool_name == "get_machine_allocation_deep":
        s = result.get("summary") or {}
        machines = result.get("machines") or []
        lines = [
            "### 🔧 Machine Allocation",
            "",
            "**📊 Fleet Summary**",
            f"- 🏭 Total Machines:      **{s.get('total_machines',0)}**",
            f"- 🟢 Allocated:           **{s.get('allocated',0)}**",
            f"- 🔵 Free / Available:    **{s.get('free_machines',0)}**",
            f"- 🔧 Under Maintenance:   **{s.get('under_maintenance',0)}**",
            f"- ⚫ Offline:             **{s.get('offline',0)}**",
            f"- 📈 Utilization:         **{s.get('utilization_pct',0)}%**",
            "",
            "**🔩 Per-Machine Allocation**",
        ]
        for m in machines:
            status_icon = {"running": "🟢", "active": "🟢", "idle": "🔵",
                           "maintenance": "🔧", "breakdown": "🔴", "offline": "⚫"}.get((m.get("machine_status") or "").lower(), "⚪")
            if m.get("is_allocated") and m.get("work_order"):
                lines.append(
                    f"- {status_icon} **{m.get('machine_code','?')}** {m.get('machine_name','')} | "
                    f"WO: {m.get('work_order','—')} | Product: {m.get('product','—')} | "
                    f"Operator: {m.get('operator','—')} | Shift: {m.get('shift','—')} | "
                    f"Supervisor: {m.get('supervisor','—')} | Capacity: {m.get('capacity_pct',0)}% | "
                    f"Status: {(m.get('machine_status') or '').upper()}"
                )
            else:
                lines.append(
                    f"- {status_icon} **{m.get('machine_code','?')}** {m.get('machine_name','')} | "
                    f"Status: {(m.get('machine_status') or '').upper()} | {'FREE' if not m.get('is_allocated') else 'UNASSIGNED'}"
                )
        return "\n".join(lines)

    if tool_name == "get_batch_summary_deep":
        s = result.get("summary") or {}
        batches = result.get("recent_batches") or []
        lines = [
            "### 📦 Batch Summary",
            "",
            "**📊 Batch Counts**",
            f"- 📦 Total Batches:  **{s.get('total_batches',0)}**",
            f"- 🟢 Running:        **{s.get('running',0)}**",
            f"- ✅ Completed:      **{s.get('completed',0)}**",
            f"- ⏸️ Hold:           **{s.get('hold',0)}**",
            f"- ❌ Rejected:       **{s.get('rejected',0)}**",
            f"- ⏰ Expired:        **{s.get('expired',0)}**",
            f"- 📏 Total Quantity: **{s.get('total_quantity',0):,.0f} units**",
        ]
        if batches:
            lines += ["", "**🕐 Recent Batches**"]
            for b in batches[:8]:
                status_icon = {"running": "🟢", "in_process": "🟢", "completed": "✅",
                               "hold": "⏸️", "rejected": "❌", "expired": "⏰"}.get((b.get("status") or "").lower(), "⚪")
                lines.append(
                    f"- {status_icon} **{b.get('batch_code','?')}** | {b.get('product','—')} | "
                    f"WO: {b.get('work_order','—')} | Qty: {b.get('quantity',0):,.0f} | "
                    f"Good: {b.get('good_qty',0):,.0f} | Scrap: {b.get('scrap_qty',0):,.1f} | "
                    f"Yield: {b.get('yield_pct',0)}% | Date: {b.get('produced_at','—')}"
                )
        return "\n".join(lines)

    if tool_name == "get_machine_status_deep":
        s = result.get("summary") or {}
        machines = result.get("machines") or []
        lines = [
            "### 🏭 Machine Status Overview",
            "",
            "**📊 Fleet Status**",
            f"- 🏭 Total Machines: **{s.get('total_machines',0)}**",
            f"- 🟢 Running:        **{s.get('running',0)}**",
            f"- 🔵 Idle:           **{s.get('idle',0)}**",
            f"- 🔧 Maintenance:    **{s.get('maintenance',0)}**",
            f"- 🔴 Breakdown:      **{s.get('breakdown',0)}**",
            f"- ⚫ Offline:         **{s.get('offline',0)}**",
            f"- 📈 Utilization:    **{s.get('utilization_pct',0)}%**",
            "",
            "**🔩 Per-Machine Details**",
        ]
        for m in machines:
            status_icon = {"running": "🟢", "active": "🟢", "idle": "🔵",
                           "maintenance": "🔧", "breakdown": "🔴", "offline": "⚫"}.get((m.get("status") or "").lower(), "⚪")
            oee = f"OEE: {m.get('oee')}%" if m.get("oee") else ""
            health = f"Health: {m.get('health_score')}/100" if m.get("health_score") else ""
            wo = f"WO: {m.get('active_work_order')}" if m.get("active_work_order") else "No active WO"
            lines.append(
                f"- {status_icon} **{m.get('machine_code','?')}** {m.get('machine_name','')} | "
                f"Status: {(m.get('status') or '').upper()} | {wo} | "
                f"Today Output: {m.get('today_output',0):,.0f} | Downtime: {m.get('today_downtime_min',0)} min"
                + (f" | {oee}" if oee else "") + (f" | {health}" if health else "")
            )
        return "\n".join(lines)

    if result.get("data"):
        return f"**{tool_name.replace('_', ' ').title()}** completed successfully."
    return f"Action **{tool_name}** completed."
