/**
 * Enterprise RBAC — module codes, action permissions, and route mapping.
 * Keep in sync with backend `app/core/rbac_constants.py` PERMISSION_MATRIX.
 */

import {
  operatorPathAllowed,
  productionManagerPathAllowed,
} from "./rbacNavFilters";
import {
  getSettingsSectionIdFromPath,
  getSettingsSectionModule,
} from "./settingsAccess";

export const ROLES = [
  { id: "admin", name: "Admin", description: "Full system access" },
  { id: "sales_manager", name: "Sales Manager", description: "Leads, quotations, sales orders, customers" },
  { id: "production_manager", name: "Production Manager", description: "Production modules for assigned plant" },
  { id: "store_manager", name: "Store Manager", description: "Inventory and store operations" },
  { id: "quality_control", name: "Quality Control", description: "Quality inspection (QA), tests, and approval stamps" },
  { id: "hr_manager", name: "HR Manager", description: "Departments and organizational data" },
  { id: "accountant", name: "Accountant", description: "Finance and accounts" },
  { id: "operator", name: "Operator", description: "Assigned work orders and machine only" },
];

export const MODULES = [
  "dashboard", "masters", "production", "inventory", "procurement",
  "sales", "accounts", "quality", "maintenance", "analytics", "alerts", "admin",
  "documents", "documents_ops", "factoryMonitor", "iot", "settings", "meetings", "hr",
];

/** Static fallback matrix — API permissions take precedence when present. */
export const ROLE_PERMISSIONS = {
  Admin: MODULES,
  admin: MODULES,
  "Production Manager": [
    "dashboard", "production", "quality", "analytics", "factoryMonitor", "alerts", "documents",
    "masters", "inventory", "maintenance", "procurement", "settings", "iot", "sales", "accounts", "meetings",
  ],
  production_manager: [
    "dashboard", "production", "quality", "analytics", "factoryMonitor", "alerts", "documents",
    "masters", "inventory", "maintenance", "procurement", "settings", "iot", "sales", "accounts", "meetings",
  ],
  "Sales Manager": ["dashboard", "sales", "masters", "alerts", "documents", "analytics", "meetings"],
  sales_manager: ["dashboard", "sales", "masters", "alerts", "documents", "analytics", "meetings"],
  "Store Manager": [
    "dashboard", "inventory", "procurement", "sales", "masters", "alerts", "documents", "settings", "analytics",
  ],
  store_manager: [
    "dashboard", "inventory", "procurement", "sales", "masters", "alerts", "documents", "settings", "analytics",
  ],
  "Purchase Manager": [
    "dashboard", "procurement", "inventory", "masters", "accounts", "alerts", "documents", "analytics",
  ],
  purchase_manager: [
    "dashboard", "procurement", "inventory", "masters", "accounts", "alerts", "documents", "analytics",
  ],
  "Procurement Manager": [
    "dashboard", "procurement", "inventory", "masters", "accounts", "alerts", "documents", "documents_ops", "analytics",
  ],
  procurement_manager: [
    "dashboard", "procurement", "inventory", "masters", "accounts", "alerts", "documents", "analytics",
  ],
  "Quality Control": [
    "dashboard", "quality", "production", "inventory", "masters", "documents", "alerts", "analytics", "meetings",
  ],
  quality_control: [
    "dashboard", "quality", "production", "inventory", "masters", "documents", "alerts", "analytics", "meetings",
  ],
  "HR Manager": ["dashboard", "hr", "analytics", "alerts", "documents", "meetings", "settings"],
  hr_manager: ["dashboard", "hr", "analytics", "alerts", "documents", "meetings", "settings"],
  Accountant: ["dashboard", "accounts", "documents", "analytics", "alerts", "masters", "meetings", "settings"],
  accountant: ["dashboard", "accounts", "documents", "analytics", "alerts", "masters", "meetings", "settings"],
  Operator: [
    "dashboard", "production", "factoryMonitor", "documents", "alerts",
  ],
  operator: [
    "dashboard", "production", "factoryMonitor", "documents", "alerts",
  ],
};

export const RESTRICTED_ACTION_ROLES = new Set(["Operator", "operator"]);

export const VALID_ACTIONS = new Set([
  "read", "create", "update", "delete", "approve",
  "create_entry", "update_qty", "update_machine_status", "report_breakdown", "*",
]);

/** Path-specific overrides evaluated before prefix matching. */
export const ROUTE_MODULE_OVERRIDES = {
  "/settings/permissions": "admin",
  "/settings/users": "admin",
  "/settings/teams": "admin",
  "/settings/company": "admin",
  "/settings/security": "admin",
  "/settings/audit": "admin",
  "/settings/ai": "admin",
  "/settings/integrations": "admin",
  "/settings/api": "admin",
  "/settings/backup": "admin",
  "/settings/change-format": "admin",
  "/settings/format-settings": "admin",
  "/settings/invoice-settings": "admin",
  "/settings/sequence-reset": "admin",
  "/settings/finance": "admin",
  "/settings/documents": "admin",
  "/settings/production": "admin",
  "/settings/manufacturing-workflow": "admin",
  "/settings/invoice-template": "admin",
  "/settings/template-settings": "admin",
  "/settings/change-template": "admin",
  "/settings/alerts": "dashboard",
  "/settings/subscription": "settings",
  "/masters/departments": "masters",
  "/masters/products": "masters",
  "/master/products": "masters",
  "/products": "masters",
  "/masters/bom": "masters",
  "/production/schedule": "production",
  "/procurement/rfq": "procurement",
  "/procurement/vendors": "masters",
  "/masters/vendors": "masters",
  "/finance/accounts-payable": "accounts",
  "/finance/accounts-receivable": "accounts",
  "/finance/payment-tracking": "accounts",
  "/finance/general-ledger": "accounts",
  "/quality/incoming": "quality",
  "/quality/in-process": "quality",
  "/quality/final": "quality",
  "/maintenance/machine-history": "maintenance",
  "/analytics/sales": "analytics",
  "/analytics/finance": "analytics",
  "/manufacturing/workflow": "dashboard",
  "/manufacturing/job-card": "sales",
  "/my-job-cards": "sales",
  "/job-cards": "sales",
  "/sales/job-cards": "sales",
  "/hr": "hr",
  "/ewaybill/login": "sales",
  "/digital-signature": "sales",
  "/purchases": "procurement",
};

export const ROUTE_MODULES = {
  "/": "dashboard",
  "/manufacturing": "dashboard",
  "/masters": "masters",
  "/master": "masters",
  "/products": "masters",
  "/production": "production",
  "/inventory": "inventory",
  "/procurement": "procurement",
  "/purchases": "procurement",
  "/sales": "sales",
  "/ewaybill": "sales",
  "/digital-signature": "sales",
  "/accounts": "accounts",
  "/ledger": "accounts",
  "/finance": "accounts",
  "/quality": "quality",
  "/maintenance": "maintenance",
  "/maintenance/equipment": "maintenance",
  "/analytics": "analytics",
  "/alerts": "alerts",
  "/admin": "admin",
  "/settings": "settings",
  "/documents": "documents",
  "/meetings": "meetings",
  "/factory-monitor": "factoryMonitor",
  "/iot": "iot",
  "/hr": "hr",
};

export function getModuleForPath(pathname) {
  const path = pathname.replace(/\/$/, "") || "/";
  if (ROUTE_MODULE_OVERRIDES[path]) return ROUTE_MODULE_OVERRIDES[path];
  const sorted = Object.keys(ROUTE_MODULES).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return ROUTE_MODULES[prefix];
    }
  }
  return "dashboard";
}

export function normalizeRoleName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_\-\s]+/g, " ");
}

export function getActiveRoleName(user) {
  if (!user) return "";
  return String(user.role || user.role_name || "").trim();
}

export function getUserRoleNames(user) {
  if (!user) return [];
  const fromArray = Array.isArray(user.roles)
    ? user.roles.map((r) => (typeof r === "object" ? r?.name : String(r))).filter(Boolean)
    : [];
  const active = getActiveRoleName(user);
  const set = new Set(fromArray);
  if (active) set.add(active);
  return [...set];
}

export function hasRole(user, roleName) {
  if (!user || !roleName) return false;
  const target = normalizeRoleName(roleName);
  return getUserRoleNames(user).some((r) => normalizeRoleName(r) === target);
}

/** Alias for userCanAccess — single permission check API. */
export function hasPermission(user, module) {
  return userCanAccess(user, module);
}

export function isAdmin(user) {
  if (!user) return false;
  if (Array.isArray(user.permissions) && user.permissions.includes("*")) return true;
  const roles = Array.isArray(user.roles) && user.roles.length
    ? user.roles
    : [user.role, user.role_name].filter(Boolean);
  return roles.includes("Admin");
}

export function getEffectivePermissions(user) {
  if (!user) return [];
  if (isAdmin(user)) return [...MODULES, "*"];
  if (Array.isArray(user.permissions) && user.permissions.length) {
    return user.permissions;
  }
  const activeRole = getActiveRoleName(user);
  const slug = activeRole.toLowerCase().replace(/\s+/g, "_");
  const fromRole =
    ROLE_PERMISSIONS[activeRole] ||
    ROLE_PERMISSIONS[slug] ||
    [];
  if (fromRole.length) return fromRole;
  const set = new Set();
  for (const role of getUserRoleNames(user)) {
    (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[role.toLowerCase().replace(/\s+/g, "_")] || []).forEach(
      (p) => set.add(p)
    );
  }
  return [...set];
}

export function userHasModule(user, module) {
  if (!user || !module) return false;
  if (isAdmin(user)) return true;
  const perms = getEffectivePermissions(user);
  if (perms.includes("*") || perms.includes(module)) return true;
  return perms.some((p) => typeof p === "string" && p.startsWith(`${module}:`));
}

export function userCanAction(user, module, action) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const perms = getEffectivePermissions(user);
  if (perms.includes("*") || perms.includes(`${module}:*`) || perms.includes(`${module}:${action}`)) {
    return true;
  }
  if (RESTRICTED_ACTION_ROLES.has(getActiveRoleName(user)) ||
      RESTRICTED_ACTION_ROLES.has(normalizeRoleName(getActiveRoleName(user)))) {
    return action === "read" || action === "view";
  }
  return perms.includes(module);
}

export function canAccess(userRole, module) {
  if (!userRole || !module) return false;
  if (userRole === "Admin") return true;
  return (ROLE_PERMISSIONS[userRole] || []).includes(module);
}

export function userCanAccess(user, module) {
  return userHasModule(user, module);
}

/** Paths Store Manager may open (inventory & warehouse operations only). */
export const STORE_MANAGER_ALLOWED_PATHS = new Set([
  "/",
  "/inventory",
  "/inventory/dashboard",
  "/inventory/settings",
  "/inventory/raw-materials",
  "/inventory/finished-goods",
  "/inventory/stock-transfer",
  "/inventory/stock-adjustment",
  "/inventory/stock-ledger",
  "/inventory/stock-movement",
  "/inventory/stock-in",
  "/inventory/material-requests",
  "/inventory/issue-materials",
  "/inventory/stock-return",
  "/inventory/history",
  "/inventory/warehouses",
  "/inventory/items",
  "/accounts/ledger",
  "/accounts/expenses",
  "/ledger",
  "/procurement/goods-receipt",
  "/procurement/material-requests",
  "/procurement/purchase-orders",
  "/procurement/supplier-payments",
  "/procurement/vendors",
  "/purchases",
  "/purchases/payments-made",
  "/purchases/debit-notes",
  "/masters/vendors",
  "/masters/products",
  "/settings",
  "/settings/subscription",
  "/settings/my-account",
  "/alerts/low-stock",
  "/documents",
  "/documents/purchase",
  "/manufacturing/workflow",
  "/my-job-cards",
]);

export function isProductionManager(user) {
  return hasRole(user, "Production Manager");
}

export function isStoreManager(user) {
  if (!user || isAdmin(user)) return false;
  return hasRole(user, "Store Manager");
}

export function isHRManager(user) {
  if (!user || isAdmin(user)) return false;
  return hasRole(user, "HR Manager");
}

export function isSalesManager(user) {
  if (!user || isAdmin(user)) return false;
  return hasRole(user, "Sales Manager");
}

export function isAccountant(user) {
  if (!user || isAdmin(user)) return false;
  return hasRole(user, "Accountant");
}

export function isQualityTeam(user) {
  if (!user || isAdmin(user)) return false;
  return (
    hasRole(user, "Quality Control") ||
    hasRole(user, "Quality Manager") ||
    hasRole(user, "Quality Inspector") ||
    hasRole(user, "QA") ||
    hasRole(user, "QC")
  );
}

/** Modules that may access the unified My Job Cards queue (matches backend WORKFLOW_MODULES). */
export const MY_JOB_CARDS_MODULES = ["sales", "production", "inventory", "quality", "accounts", "admin"];

export function userCanAccessMyJobCards(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return MY_JOB_CARDS_MODULES.some((m) => userCanAccess(user, m));
}

export function storeManagerPathAllowed(pathname) {
  if (!pathname) return false;
  const path = pathname.replace(/\/$/, "") || "/";
  if (path === "/") return true;
  if (path.startsWith("/job-cards/")) return true;
  if (STORE_MANAGER_ALLOWED_PATHS.has(path)) return true;
  if (path.startsWith("/inventory")) return true;
  if (path.startsWith("/purchases")) return true;
  if (path.startsWith("/procurement")) return true;
  if (path.startsWith("/accounts/ledger")) return true;
  if (path.startsWith("/accounts/expenses")) return true;
  if (path.startsWith("/masters/products")) return true;
  if (path.startsWith("/procurement/goods-receipt")) return true;
  if (path.startsWith("/procurement/material-requests")) return true;
  if (path.startsWith("/procurement/vendors")) return true;
  if (path.startsWith("/masters/vendors")) return true;
  if (path.startsWith("/settings")) return true;
  if (path.startsWith("/alerts")) return true;
  if (path.startsWith("/documents")) return true;
  if (path.startsWith("/manufacturing")) return true;
  return false;
}

export function userCanAccessSettingsSection(user, sectionId) {
  if (!user || !sectionId) return false;
  return userCanAccess(user, getSettingsSectionModule(sectionId));
}

export function filterAccessibleSettingsCategories(categories, user) {
  if (!user) return [];
  return (categories || []).filter((cat) => userCanAccessSettingsSection(user, cat.id));
}

export function userCanAccessPath(user, pathname) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  const path = (pathname || "").replace(/\/$/, "") || "/";
  if (path === "/my-job-cards" || path.startsWith("/job-cards/")) {
    if (!userCanAccessMyJobCards(user)) return false;
    if (isStoreManager(user) && !storeManagerPathAllowed(pathname)) return false;
    if (isProductionManager(user) && !productionManagerPathAllowed(pathname)) return false;
    if (isOperator(user) && !operatorPathAllowed(pathname)) return false;
    return true;
  }
  if (path.startsWith("/procurement/vendors") || path.startsWith("/masters/vendors")) {
    if (isProductionManager(user)) return false;
    if (!userCanAccess(user, "masters") && !userCanAccess(user, "procurement")) return false;
    if (isStoreManager(user) && !storeManagerPathAllowed(pathname)) return false;
    return true;
  }
  const module = getModuleForPath(pathname);
  if (!userCanAccess(user, module)) return false;
  const settingsSection = getSettingsSectionIdFromPath(path);
  if (settingsSection && !userCanAccessSettingsSection(user, settingsSection)) return false;
  if (isStoreManager(user) && !storeManagerPathAllowed(pathname)) return false;
  if (isProductionManager(user) && !productionManagerPathAllowed(pathname)) return false;
  if (isOperator(user) && !operatorPathAllowed(pathname)) return false;
  return true;
}

export function isOperator(user) {
  if (!user) return false;
  return hasRole(user, "Operator");
}

/** Human-readable label for a module code or granular permission (e.g. production:read). */
export function permissionLabel(code, modules = []) {
  const exact = modules.find((m) => m.code === code);
  if (exact) return exact.label;
  if (code.includes(":")) {
    const [module, action] = code.split(":", 2);
    const moduleEntry = modules.find((m) => m.code === module);
    const moduleLabel = moduleEntry?.label || module;
    const actionLabel = action.replace(/_/g, " ");
    return `${moduleLabel} (${actionLabel})`;
  }
  return code.replace(/_/g, " ");
}

/** Count module-level grants (excludes granular action codes). */
export function countModulePermissions(permissions = [], modules = []) {
  const moduleCodes = new Set(modules.map((m) => m.code));
  return permissions.filter((p) => moduleCodes.has(p)).length;
}