"""RBAC constants shared by permissions helpers and role seeding."""

MODULE_CATALOG = [
    {"code": "dashboard", "label": "Dashboard"},
    {"code": "masters", "label": "Masters"},
    {"code": "production", "label": "Production"},
    {"code": "inventory", "label": "Inventory & Raw Materials"},
    {"code": "procurement", "label": "Procurement"},
    {"code": "sales", "label": "Sales & Billing"},
    {"code": "accounts", "label": "Accounts & Reports"},
    {"code": "quality", "label": "Quality Control"},
    {"code": "maintenance", "label": "Maintenance"},
    {"code": "analytics", "label": "Analytics"},
    {"code": "alerts", "label": "Alerts & Notifications"},
    {"code": "documents", "label": "Documents"},
    {"code": "meetings", "label": "Meetings"},
    {"code": "factoryMonitor", "label": "Factory Monitor"},
    {"code": "iot", "label": "IoT & Smart Factory"},
    {"code": "hr", "label": "Human Resources"},
    {"code": "settings", "label": "Settings"},
    {"code": "admin", "label": "Security & Administration"},
]

VALID_MODULES = {m["code"] for m in MODULE_CATALOG}

VALID_ACTIONS = frozenset({
    "read",
    "create",
    "update",
    "delete",
    "approve",
    "create_entry",
    "update_qty",
    "update_machine_status",
    "report_breakdown",
    "*",
})

# Canonical registerable role names (must match Role.name in DB).
REGISTERABLE_ROLES = [
    "Admin",
    "Sales Manager",
    "Production Manager",
    "Store Manager",
    "Purchase Manager",
    "Procurement Manager",
    "HR Manager",
    "Accountant",
    "Operator",
]

PERMISSION_MATRIX = {
    "Admin": {
        "modules": list(VALID_MODULES),
        "description": "Full system access — Management view of entire manufacturing workflow.",
    },
    "Sales Manager": {
        "modules": [
            "dashboard",
            "sales",
            "masters",
            "alerts",
            "documents",
            "analytics",
            "meetings",
        ],
        "description": (
            "Leads, quotations, sales orders, customers, dispatch follow-up, and sales KPIs."
        ),
    },
    "Production Manager": {
        "modules": [
            "dashboard",
            "production",
            "quality",
            "analytics",
            "factoryMonitor",
            "alerts",
            "documents",
            "meetings",
            "masters",
            "inventory",
            "maintenance",
            "procurement",
            "settings",
            "iot",
        ],
        "description": (
            "Dashboard, Production, Planning, Work Orders, Quality, "
            "Inventory, Maintenance, Procurement, Analytics, and Smart Factory IoT."
        ),
    },
    "Store Manager": {
        "modules": [
            "dashboard",
            "inventory",
            "procurement",
            "sales",
            "masters",
            "alerts",
            "documents",
            "settings",
            "analytics",
        ],
        "description": (
            "Store operations: inventory, warehouses, GRN, finished goods, and dispatch."
        ),
    },
    "Purchase Manager": {
        "modules": [
            "dashboard",
            "procurement",
            "inventory",
            "masters",
            "accounts",
            "alerts",
            "documents",
            "analytics",
        ],
        "description": "Full Vendor Master and purchase lifecycle access.",
    },
    "Procurement Manager": {
        "modules": [
            "dashboard",
            "procurement",
            "inventory",
            "masters",
            "accounts",
            "alerts",
            "documents",
            "analytics",
        ],
        "description": "Full Vendor Master and procurement operations access.",
    },
    "HR Manager": {
        "modules": ["dashboard", "hr", "analytics", "alerts", "documents", "meetings", "settings"],
        "description": "Employees, attendance, leave, payroll, and HR reports.",
    },
    "Accountant": {
        "modules": [
            "dashboard",
            "accounts",
            "sales",
            "documents",
            "analytics",
            "alerts",
            "masters",
            "meetings",
        ],
        "description": "Tax invoice, payments, AR/AP, and financial transactions.",
    },
    "Operator": {
        "modules": [
            "dashboard",
            "production",
            "factoryMonitor",
            "documents",
            "alerts",
            "masters",
        ],
        "actions": [
            "production:read",
            "production:create_entry",
            "production:update_qty",
            "production:update_machine_status",
            "production:report_breakdown",
            "documents:read",
        ],
        "description": (
            "Assigned work orders, quantity/downtime entry, machine issues."
        ),
    },
}

# Sidebar / route paths Store Manager may see.
# Module grants stay broader so GRN/dispatch APIs still authorize; UI is narrowed here.
STORE_MANAGER_ALLOWED_PATHS = frozenset({
    "/",
    "/manufacturing/workflow",
    "/inventory",
    "/inventory/raw-materials",
    "/inventory/finished-goods",
    "/inventory/stock-transfer",
    "/inventory/stock-adjustment",
    "/inventory/stock-ledger",
    "/inventory/warehouses",
    "/procurement/goods-receipt",
    "/procurement/material-requests",
    "/procurement/purchase-orders",
    "/procurement/supplier-payments",
    "/procurement/vendors",
    "/purchases",
    "/purchases/payments-made",
    "/purchases/debit-notes",
    "/sales/dispatch",
    "/masters/products",
    "/alerts/low-stock",
    "/documents",
    "/documents/purchase",
    "/analytics/inventory",
    "/settings",
    "/settings/my-account",
    "/settings/subscription",
    "/settings/notifications",
    "/settings/appearance",
    "/settings/security",
    "/inventory/settings",
})


def store_manager_path_allowed(path: str | None) -> bool:
    """Return True when path is allowed for the Store Manager role."""
    if not path:
        return False
    normalized = path.rstrip("/") or "/"
    if normalized in STORE_MANAGER_ALLOWED_PATHS:
        return True
    if normalized.startswith("/inventory/"):
        return True
    if normalized.startswith("/masters/products"):
        return True
    if normalized.startswith("/procurement/goods-receipt"):
        return True
    if normalized.startswith("/procurement/material-requests"):
        return True
    if normalized.startswith("/procurement/purchase-orders"):
        return True
    if normalized.startswith("/procurement/supplier-payments"):
        return True
    if normalized.startswith("/procurement/vendors"):
        return True
    if normalized.startswith("/purchases"):
        return True
    if normalized.startswith("/sales/dispatch"):
        return True
    if normalized.startswith("/settings"):
        return True
    if normalized.startswith("/inventory/settings"):
        return True
    return False


# Sidebar menu catalog — filtered by role modules when building /api/sidebar.
SIDEBAR_MENU_CATALOG = [
    {
        "key": "dashboard",
        "label": "Dashboard",
        "path": "/",
        "module": "dashboard",
        "children": [
            {"label": "Manufacturing Workflow", "path": "/manufacturing/workflow", "module": "dashboard"},
        ],
    },
    {
        "key": "masters",
        "label": "Masters",
        "path": None,
        "module": "masters",
        "children": [
            {"label": "Customers", "path": "/sales/customers", "module": "masters"},
            {"label": "Vendors", "path": "/procurement/vendors", "module": "masters"},
            {"label": "Products", "path": "/masters/products", "module": "masters"},
        ],
    },
    {
        "key": "production",
        "label": "Production",
        "path": None,
        "module": "production",
        "children": [
            {"label": "Production Planning", "path": "/production/planning", "module": "production"},
            {"label": "Work Orders", "path": "/production/work-orders", "module": "production"},
            {"label": "Job Card", "path": "/production/job-card", "module": "production"},
            {"label": "Production Schedule", "path": "/production/schedule", "module": "production"},
            {"label": "Machine Allocation", "path": "/production/tasks", "module": "production"},
            {"label": "Daily Production Reports", "path": "/production/reports", "module": "production"},
        ],
    },
    {
        "key": "inventory",
        "label": "Inventory",
        "path": None,
        "module": "inventory",
        "children": [
            {"label": "Inventory", "path": "/inventory", "module": "inventory"},
            {"label": "Store Dashboard", "path": "/inventory/dashboard", "module": "inventory"},
            {"label": "Raw Materials", "path": "/inventory/raw-materials", "module": "inventory"},
            {"label": "Finished Goods", "path": "/inventory/finished-goods", "module": "inventory"},
            {"label": "Stock Transfer", "path": "/inventory/stock-transfer", "module": "inventory"},
            {"label": "Stock Adjustment", "path": "/inventory/stock-adjustment", "module": "inventory"},
            {"label": "Stock Ledger", "path": "/inventory/stock-ledger", "module": "inventory"},
            {"label": "Warehouses", "path": "/inventory/warehouses", "module": "inventory"},
            {"label": "Inventory Settings", "path": "/inventory/settings", "module": "inventory"},
        ],
    },
    {
        "key": "procurement",
        "label": "Purchases",
        "path": None,
        "module": "procurement",
        "children": [
            {"label": "Purchase", "path": "/purchases", "module": "procurement"},
            {"label": "Payments Made", "path": "/purchases/payments-made", "module": "procurement"},
            {"label": "Debit Note", "path": "/purchases/debit-notes", "module": "procurement"},
            {"label": "Purchase Order", "path": "/procurement/purchase-orders", "module": "procurement"},
        ],
    },
    {
        "key": "sales",
        "label": "Sales",
        "path": None,
        "module": "sales",
        "children": [
            {"label": "Sales Dashboard", "path": "/sales/dashboard", "module": "sales"},
            {"label": "Leads", "path": "/sales/leads", "module": "sales"},
            {"label": "Quotations", "path": "/sales/quotations", "module": "sales"},
            {"label": "Sales Orders", "path": "/sales/orders", "module": "sales"},
            {"label": "Customers", "path": "/masters/customers", "module": "sales"},
            {"label": "Work Orders", "path": "/production/work-orders", "module": "sales"},
            {"label": "Job Card", "path": "/production/job-card", "module": "sales"},
            {"label": "Dispatch", "path": "/sales/dispatch", "module": "sales"},
            {"label": "Manufacturing Workflow", "path": "/manufacturing/workflow", "module": "dashboard"},
        ],
    },
    {
        "key": "expense",
        "label": "Expense",
        "path": "/accounts/expenses",
        "module": "accounts",
        "children": [],
    },
    {
        "key": "finance",
        "label": "Accounting",
        "path": None,
        "module": "accounts",
        "children": [
            {"label": "Invoices", "path": "/sales/invoices", "module": "accounts"},
            {"label": "Quotations", "path": "/sales/quotations", "module": "accounts"},
            {"label": "Payment Receipts", "path": "/sales/payment-receipts", "module": "accounts"},
            {"label": "Refund Vouchers", "path": "/sales/refund-vouchers", "module": "accounts"},
            {"label": "Proforma Invoice", "path": "/sales/proforma-invoices", "module": "accounts"},
            {"label": "Export Invoice", "path": "/sales/export-invoices", "module": "accounts"},
            {"label": "Export Proforma Invoice", "path": "/sales/export-proforma-invoices", "module": "accounts"},
            {"label": "Delivery Challans", "path": "/sales/delivery-challans", "module": "accounts"},
            {"label": "Credit Note", "path": "/sales/credit-notes", "module": "accounts"},
            {"label": "e-Invoice", "path": "/sales/e-invoice", "module": "accounts"},
            {"label": "Sales Debit Note", "path": "/sales/debit-notes", "module": "accounts"},
            {"label": "E-Waybill Login", "path": "/ewaybill/login", "module": "accounts"},
            {"label": "Digital Signature", "path": "/digital-signature", "module": "accounts"},
            {"label": "Ledger", "path": "/accounts/ledger", "module": "accounts"},
            {"label": "Expense", "path": "/accounts/expenses", "module": "accounts"},
            {"label": "Expense Settings", "path": "/accounts/expenses/settings", "module": "accounts"},
            {"label": "Chart of Accounts", "path": "/accounts/chart-of-accounts", "module": "accounts"},
            {"label": "Manual Journal Entry", "path": "/accounts/journal-entries", "module": "accounts"},
            {"label": "Balance Sheet", "path": "/accounts/balance-sheet", "module": "accounts"},
            {"label": "Profit & Loss Report", "path": "/accounts/profit-loss", "module": "accounts"},
            {"label": "Accounting Reports", "path": "/accounts/reports", "module": "accounts"},
            {"label": "Restore Deleted Doc.", "path": "/accounts/restore-deleted", "module": "accounts"},
        ],
    },
    {
        "key": "quality",
        "label": "Quality",
        "path": None,
        "module": "quality",
        "children": [
            {"label": "Quality Dashboard", "path": "/quality", "module": "quality"},
            {"label": "Incoming Inspection", "path": "/quality/incoming", "module": "quality"},
            {"label": "In-Process QC", "path": "/quality/in-process", "module": "quality"},
            {"label": "Final QC", "path": "/quality/final", "module": "quality"},
            {"label": "Batch Reports", "path": "/quality/batch-reports", "module": "quality"},
            {"label": "Rejections", "path": "/quality/defects", "module": "quality"},
        ],
    },
    {
        "key": "maintenance",
        "label": "Maintenance",
        "path": None,
        "module": "maintenance",
        "children": [
            {"label": "Maintenance Dashboard", "path": "/maintenance", "module": "maintenance"},
            {"label": "Equipment & Spare Parts", "path": "/maintenance/equipment", "module": "maintenance"},
            {"label": "Preventive Maintenance", "path": "/maintenance/preventive", "module": "maintenance"},
            {"label": "Breakdown Maintenance", "path": "/maintenance/breakdowns", "module": "maintenance"},
            {"label": "Machine History", "path": "/maintenance/machine-history", "module": "maintenance"},
            {"label": "Maintenance Schedule", "path": "/maintenance/schedule", "module": "maintenance"},
        ],
    },
    {
        "key": "alerts",
        "label": "Alerts",
        "path": None,
        "module": "alerts",
        "children": [
            {"label": "All Alerts", "path": "/alerts", "module": "alerts"},
            {"label": "Low Stock", "path": "/alerts/low-stock", "module": "alerts"},
            {"label": "Machine / Equipment", "path": "/alerts/machine-failure", "module": "alerts"},
            {"label": "Production Delay", "path": "/alerts/production-delay", "module": "alerts"},
            {"label": "Maintenance", "path": "/alerts/maintenance", "module": "alerts"},
            {"label": "Quality", "path": "/alerts/quality", "module": "alerts"},
            {"label": "Safety & Incident", "path": "/alerts/safety", "module": "alerts"},
            {"label": "General", "path": "/alerts/general", "module": "alerts"},
        ],
    },
    {
        "key": "documents",
        "label": "Documents",
        "path": None,
        "module": "documents",
        "children": [
            {"label": "All Documents", "path": "/documents", "module": "documents"},
            {"label": "Purchase", "path": "/documents/purchase", "module": "documents"},
            {"label": "Production", "path": "/documents/production", "module": "documents"},
            {"label": "Quality", "path": "/documents/quality", "module": "documents"},
            {"label": "Reports", "path": "/documents/reports", "module": "documents"},
        ],
    },
    {
        "key": "meetings",
        "label": "Meetings",
        "path": None,
        "module": "meetings",
        "children": [
            {"label": "All Meetings", "path": "/meetings", "module": "meetings"},
        ],
    },
    {
        "key": "analytics",
        "label": "Analytics",
        "path": None,
        "module": "analytics",
        "children": [
            {"label": "Executive Dashboard", "path": "/analytics/executive", "module": "analytics"},
            {"label": "Live Dashboard", "path": "/analytics/live", "module": "analytics"},
            {"label": "Production KPI", "path": "/analytics/production", "module": "analytics"},
            {"label": "Inventory KPI", "path": "/analytics/inventory", "module": "analytics"},
            {"label": "Sales KPI", "path": "/analytics/sales", "module": "analytics"},
            {"label": "Finance KPI", "path": "/analytics/finance", "module": "analytics"},
        ],
    },
    {
        "key": "hr",
        "label": "Human Resources",
        "path": None,
        "module": "hr",
        "children": [
            {"label": "HR Dashboard", "path": "/hr", "module": "hr"},
            {"label": "Employees", "path": "/hr/employees", "module": "hr"},
            {"label": "Attendance", "path": "/hr/attendance", "module": "hr"},
            {"label": "Leave", "path": "/hr/leave", "module": "hr"},
            {"label": "Payroll", "path": "/hr/payroll", "module": "hr"},
            {"label": "Performance", "path": "/hr/performance", "module": "hr"},
            {"label": "Training", "path": "/hr/training", "module": "hr"},
            {"label": "Recruitment", "path": "/hr/recruitment", "module": "hr"},
            {"label": "Shifts", "path": "/hr/shifts", "module": "hr"},
            {"label": "Assets", "path": "/hr/assets", "module": "hr"},
            {"label": "Incidents", "path": "/hr/incidents", "module": "hr"},
            {"label": "HR Documents", "path": "/hr/documents", "module": "hr"},
            {"label": "HR Settings", "path": "/hr/settings", "module": "hr"},
        ],
    },
    {
        "key": "admin",
        "label": "Administration",
        "path": None,
        "module": "admin",
        "children": [
            {"label": "Users", "path": "/admin/users", "module": "admin"},
            {"label": "Roles & Permissions", "path": "/admin/roles", "module": "admin"},
            {"label": "Access Logs", "path": "/admin/audit-logs", "module": "admin"},
        ],
    },
    {
        "key": "settings",
        "label": "Settings",
        "path": None,
        "module": "settings",
        "children": [
            {"label": "All Settings", "path": "/settings", "module": "settings"},
            {"label": "Appearance", "path": "/settings/appearance", "module": "settings"},
            {"label": "Change Format", "path": "/settings/change-format", "module": "settings"},
            {"label": "Invoice Settings", "path": "/settings/invoice-settings", "module": "settings"},
            {"label": "Expense Settings", "path": "/accounts/expenses/settings", "module": "accounts"},
            {"label": "Inventory Settings", "path": "/inventory/settings", "module": "settings"},
            {"label": "Sequence Reset Setting", "path": "/settings/sequence-reset", "module": "settings"},
        ],
    },
]
