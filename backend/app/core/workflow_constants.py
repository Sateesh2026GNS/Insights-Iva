"""Manufacturing order workflow — canonical statuses, transitions, and team roles."""

from __future__ import annotations

from typing import FrozenSet

# ── Canonical workflow statuses ─────────────────────────────────────────────

WORKFLOW_STATUSES = frozenset({
    "SALES_CONFIRMED",
    "MATERIAL_CHECK_PENDING",
    "MATERIAL_AVAILABLE",
    "MATERIAL_SHORTAGE",
    "MATERIAL_PARTIAL",
    "WORKFLOW_ON_HOLD",
    "STORE_ISSUE_PENDING",
    "STORE_ISSUE_PARTIAL",
    "READY_FOR_PRODUCTION",
    "PRODUCTION_ASSIGNED",
    "PRODUCTION_IN_PROGRESS",
    "PRODUCTION_COMPLETED",
    "PRODUCTION_REWORK",
    "QUALITY_CHECK_PENDING",
    "QUALITY_ON_HOLD",
    "QUALITY_APPROVED",
    "QUALITY_REJECTED",
    "PACKING_PENDING",
    "PACKING_IN_PROGRESS",
    "PACKED",
    "PACKING_ISSUE",
    "BILLING_PENDING",
    "INVOICED",
    "BILLING_HOLD",
    "COMPLETED",
})

ORDER_PRIORITIES = frozenset({"high", "medium", "low"})

# User-facing labels for workflow_status (canonical backend values only).
WORKFLOW_STATUS_LABELS: dict[str, str] = {
    "SALES_CONFIRMED": "Sales Confirmed",
    "MATERIAL_CHECK_PENDING": "Pending Inventory Check",
    "MATERIAL_AVAILABLE": "Materials Confirmed",
    "MATERIAL_SHORTAGE": "Material Shortage",
    "MATERIAL_PARTIAL": "Material Partial",
    "WORKFLOW_ON_HOLD": "On Hold",
    "STORE_ISSUE_PENDING": "Store Issue Pending",
    "STORE_ISSUE_PARTIAL": "Store Issue Partial",
    "READY_FOR_PRODUCTION": "Production Pending",
    "PRODUCTION_ASSIGNED": "Assigned to Operator",
    "PRODUCTION_IN_PROGRESS": "In Production",
    "PRODUCTION_COMPLETED": "Production Completed",
    "PRODUCTION_REWORK": "Rework Required",
    "QUALITY_CHECK_PENDING": "Quality Pending",
    "QUALITY_ON_HOLD": "Quality On Hold",
    "QUALITY_APPROVED": "Quality Approved",
    "QUALITY_REJECTED": "Quality Rejected",
    "PACKING_PENDING": "Packing Pending",
    "PACKING_IN_PROGRESS": "Packing In Progress",
    "PACKED": "Packed",
    "PACKING_ISSUE": "Packing Issue",
    "BILLING_PENDING": "Billing Pending",
    "INVOICED": "Invoiced",
    "BILLING_HOLD": "Billing Hold",
    "COMPLETED": "Completed",
}


def workflow_status_label(status: str | None) -> str:
    """Return display label for a canonical workflow_status value."""
    if not status:
        return "—"
    key = status.upper()
    return WORKFLOW_STATUS_LABELS.get(key, status.replace("_", " ").title())

# Team keys used for RBAC on transitions
TEAM_SALES = "sales"
TEAM_INVENTORY = "inventory"
TEAM_PRODUCTION = "production"
TEAM_OPERATOR = "operator"
TEAM_QUALITY = "quality"
TEAM_PACKING = "packing"
TEAM_BILLING = "billing"
TEAM_ADMIN = "admin"

# Map ERP roles → workflow teams (user may belong to multiple)
ROLE_TO_TEAMS: dict[str, frozenset[str]] = {
    "Admin": frozenset({TEAM_ADMIN, TEAM_SALES, TEAM_INVENTORY, TEAM_PRODUCTION, TEAM_OPERATOR, TEAM_QUALITY, TEAM_PACKING, TEAM_BILLING}),
    "Sales Manager": frozenset({TEAM_SALES}),
    "Store Manager": frozenset({TEAM_INVENTORY, TEAM_PACKING}),
    "Production Manager": frozenset({TEAM_PRODUCTION, TEAM_QUALITY}),
    "Operator": frozenset({TEAM_OPERATOR}),
    "Accountant": frozenset({TEAM_BILLING}),
    "Purchase Manager": frozenset({TEAM_INVENTORY}),
    "Procurement Manager": frozenset({TEAM_INVENTORY}),
    "Quality Control": frozenset({TEAM_QUALITY}),
    "Quality Manager": frozenset({TEAM_QUALITY}),
    "Quality Inspector": frozenset({TEAM_QUALITY}),
}

# Allowed transitions: from_status → {to_status: required_team}
WORKFLOW_TRANSITIONS: dict[str, dict[str, str]] = {
    "draft": {
        "SALES_CONFIRMED": TEAM_SALES,
    },
    "SALES_CONFIRMED": {
        "MATERIAL_CHECK_PENDING": TEAM_SALES,
    },
    "MATERIAL_CHECK_PENDING": {
        "MATERIAL_AVAILABLE": TEAM_INVENTORY,
        "MATERIAL_SHORTAGE": TEAM_INVENTORY,
        "MATERIAL_PARTIAL": TEAM_INVENTORY,
        "WORKFLOW_ON_HOLD": TEAM_INVENTORY,
    },
    "MATERIAL_SHORTAGE": {
        "MATERIAL_AVAILABLE": TEAM_INVENTORY,
        "MATERIAL_PARTIAL": TEAM_INVENTORY,
        "WORKFLOW_ON_HOLD": TEAM_INVENTORY,
    },
    "MATERIAL_PARTIAL": {
        "MATERIAL_AVAILABLE": TEAM_INVENTORY,
        "WORKFLOW_ON_HOLD": TEAM_INVENTORY,
    },
    "MATERIAL_AVAILABLE": {
        "STORE_ISSUE_PENDING": TEAM_INVENTORY,
        "WORKFLOW_ON_HOLD": TEAM_INVENTORY,
    },
    "WORKFLOW_ON_HOLD": {
        "MATERIAL_CHECK_PENDING": TEAM_INVENTORY,
        "STORE_ISSUE_PENDING": TEAM_INVENTORY,
        "READY_FOR_PRODUCTION": TEAM_PRODUCTION,
        "PRODUCTION_ASSIGNED": TEAM_PRODUCTION,
        "QUALITY_CHECK_PENDING": TEAM_QUALITY,
        "PACKING_PENDING": TEAM_PACKING,
        "BILLING_PENDING": TEAM_BILLING,
    },
    "STORE_ISSUE_PENDING": {
        "STORE_ISSUE_PARTIAL": TEAM_INVENTORY,
        "READY_FOR_PRODUCTION": TEAM_INVENTORY,
        "WORKFLOW_ON_HOLD": TEAM_INVENTORY,
    },
    "STORE_ISSUE_PARTIAL": {
        "STORE_ISSUE_PENDING": TEAM_INVENTORY,
        "READY_FOR_PRODUCTION": TEAM_INVENTORY,
        "WORKFLOW_ON_HOLD": TEAM_INVENTORY,
    },
    "READY_FOR_PRODUCTION": {
        "PRODUCTION_ASSIGNED": TEAM_PRODUCTION,
    },
    "PRODUCTION_ASSIGNED": {
        "PRODUCTION_IN_PROGRESS": TEAM_OPERATOR,
        "PRODUCTION_ASSIGNED": TEAM_PRODUCTION,
    },
    "PRODUCTION_IN_PROGRESS": {
        "PRODUCTION_COMPLETED": TEAM_OPERATOR,
        "PRODUCTION_REWORK": TEAM_PRODUCTION,
    },
    "PRODUCTION_REWORK": {
        "PRODUCTION_IN_PROGRESS": TEAM_OPERATOR,
        "PRODUCTION_ASSIGNED": TEAM_PRODUCTION,
    },
    "PRODUCTION_COMPLETED": {
        "QUALITY_CHECK_PENDING": TEAM_OPERATOR,
    },
    "QUALITY_CHECK_PENDING": {
        "QUALITY_APPROVED": TEAM_QUALITY,
        "QUALITY_REJECTED": TEAM_QUALITY,
        "QUALITY_ON_HOLD": TEAM_QUALITY,
    },
    "QUALITY_ON_HOLD": {
        "QUALITY_APPROVED": TEAM_QUALITY,
        "QUALITY_REJECTED": TEAM_QUALITY,
        "QUALITY_CHECK_PENDING": TEAM_QUALITY,
    },
    "QUALITY_REJECTED": {
        "PRODUCTION_REWORK": TEAM_PRODUCTION,
        "QUALITY_CHECK_PENDING": TEAM_QUALITY,
    },
    "QUALITY_APPROVED": {
        "PACKING_PENDING": TEAM_QUALITY,
    },
    "PACKING_PENDING": {
        "PACKING_IN_PROGRESS": TEAM_PACKING,
        "PACKING_ISSUE": TEAM_PACKING,
    },
    "PACKING_IN_PROGRESS": {
        "PACKED": TEAM_PACKING,
        "PACKING_ISSUE": TEAM_PACKING,
    },
    "PACKING_ISSUE": {
        "PACKING_IN_PROGRESS": TEAM_PACKING,
        "PACKED": TEAM_PACKING,
    },
    "PACKED": {
        "BILLING_PENDING": TEAM_PACKING,
    },
    "BILLING_PENDING": {
        "INVOICED": TEAM_BILLING,
        "BILLING_HOLD": TEAM_BILLING,
    },
    "BILLING_HOLD": {
        "BILLING_PENDING": TEAM_BILLING,
        "INVOICED": TEAM_BILLING,
    },
    "INVOICED": {
        "COMPLETED": TEAM_BILLING,
    },
}

# Admin dashboard count buckets → filter path
WORKFLOW_COUNT_BUCKETS: list[dict[str, str]] = [
    {"key": "sales_confirmed", "statuses": "SALES_CONFIRMED", "label": "Sales Orders", "path": "/manufacturing/workflow?status=SALES_CONFIRMED"},
    {"key": "inventory_pending", "statuses": "MATERIAL_CHECK_PENDING", "label": "Inventory Pending", "path": "/manufacturing/workflow?status=MATERIAL_CHECK_PENDING"},
    {"key": "inventory_shortage", "statuses": "MATERIAL_SHORTAGE,MATERIAL_PARTIAL", "label": "Inventory Shortage", "path": "/manufacturing/workflow?status=MATERIAL_SHORTAGE"},
    {"key": "store_pending", "statuses": "STORE_ISSUE_PENDING,STORE_ISSUE_PARTIAL,MATERIAL_AVAILABLE", "label": "Store Pending", "path": "/manufacturing/workflow?status=STORE_ISSUE_PENDING"},
    {"key": "production_pending", "statuses": "READY_FOR_PRODUCTION", "label": "Production Pending", "path": "/manufacturing/workflow?status=READY_FOR_PRODUCTION"},
    {"key": "production_assigned", "statuses": "PRODUCTION_ASSIGNED", "label": "Production Assigned", "path": "/manufacturing/workflow?status=PRODUCTION_ASSIGNED"},
    {"key": "operator_in_progress", "statuses": "PRODUCTION_IN_PROGRESS", "label": "Operator In Progress", "path": "/manufacturing/workflow?status=PRODUCTION_IN_PROGRESS"},
    {"key": "quality_pending", "statuses": "QUALITY_CHECK_PENDING,QUALITY_ON_HOLD", "label": "Quality Pending", "path": "/manufacturing/workflow?status=QUALITY_CHECK_PENDING"},
    {"key": "packing_pending", "statuses": "PACKING_PENDING,PACKING_IN_PROGRESS", "label": "Packing Pending", "path": "/manufacturing/workflow?status=PACKING_PENDING"},
    {"key": "billing_pending", "statuses": "BILLING_PENDING,BILLING_HOLD", "label": "Billing Pending", "path": "/manufacturing/workflow?status=BILLING_PENDING"},
    {"key": "completed", "statuses": "COMPLETED", "label": "Completed", "path": "/manufacturing/workflow?status=COMPLETED"},
]

# Notification target roles per transition target status
STATUS_NOTIFY_ROLES: dict[str, list[str]] = {
    "MATERIAL_CHECK_PENDING": ["Store Manager", "Admin"],
    "STORE_ISSUE_PENDING": ["Store Manager", "Admin"],
    "READY_FOR_PRODUCTION": ["Production Manager", "Admin"],
    "PRODUCTION_ASSIGNED": ["Operator", "Admin"],
    "QUALITY_CHECK_PENDING": ["Production Manager", "Admin"],
    "PACKING_PENDING": ["Store Manager", "Admin"],
    "BILLING_PENDING": ["Accountant", "Admin"],
    "COMPLETED": ["Sales Manager", "Admin"],
    "QUALITY_REJECTED": ["Production Manager", "Operator", "Admin"],
    "WORKFLOW_ON_HOLD": ["Store Manager", "Production Manager", "Admin"],
}


def normalize_priority(value: str | None) -> str:
    v = (value or "medium").strip().lower()
    return v if v in ORDER_PRIORITIES else "medium"


def user_teams(role_names: list[str]) -> FrozenSet[str]:
    teams: set[str] = set()
    for name in role_names:
        teams.update(ROLE_TO_TEAMS.get(name, ()))
    return frozenset(teams)


def transition_allowed(from_status: str | None, to_status: str) -> bool:
    src = (from_status or "draft").upper() if from_status != "draft" else "draft"
    if src == "DRAFT":
        src = "draft"
    targets = WORKFLOW_TRANSITIONS.get(src, {})
    return to_status.upper() in {k.upper(): v for k, v in targets.items()}


def required_team_for_transition(from_status: str | None, to_status: str) -> str | None:
    src = (from_status or "draft")
    if src.upper() not in ("DRAFT",) and src != "draft":
        src = src.upper()
    targets = WORKFLOW_TRANSITIONS.get(src, {})
    for tgt, team in targets.items():
        if tgt.upper() == to_status.upper():
            return team
    return None
