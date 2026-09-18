import { isAiCopilotEnabled, isOperatorAiRoute } from "./aiCopilot";
import {
  isAdmin,
  isOperator,
  userCanAccess,
} from "../config/permissions";
import { operatorPathAllowed } from "../config/rbacNavFilters";

/** Single shared ERP AI assistant (backend: /api/agent/chat + role-filtered tools). */
export const AI_ASSISTANT_MODES = {
  SHARED: "shared",
};

/** @deprecated use AI_ASSISTANT_MODES.SHARED */
export const AI_ASSISTANT_MODES_LEGACY = {
  OPERATOR: "shared",
  REGISTRY: "shared",
};

function normalizePath(pathname) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/** Routes where the ERP shell shows the floating AI assistant (not auth/admin). */
export function isErpAiEligibleRoute(pathname) {
  const path = normalizePath(pathname);
  if (
    path === "/login" ||
    path === "/register" ||
    path === "/landing" ||
    path === "/forgot-password" ||
    path === "/reset-password" ||
    path === "/verify-email"
  ) {
    return false;
  }
  if (path.startsWith("/gns-admin")) return false;
  if (path === "/settings" || path.startsWith("/settings/")) return false;
  return true;
}

/** Backend `/api/agent/chat` — role-filtered tools server-side. */
const SHARED_AGENT_MODULES = [
  "inventory",
  "sales",
  "production",
  "quality",
  "hr",
  "accounts",
  "dashboard",
  "admin",
];

export function userCanUseSharedAgent(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  if (isOperator(user)) return true;
  return SHARED_AGENT_MODULES.some((mod) => userCanAccess(user, mod));
}

/** @deprecated use userCanUseSharedAgent */
export function userCanUseRegistryAgent(user) {
  return userCanUseSharedAgent(user) && !isOperator(user);
}

/**
 * Which assistant to mount in the app shell (single instance).
 * @returns {'shared'|null}
 */
export function resolveErpAiAssistantMode(user, pathname) {
  if (!user || !isAiCopilotEnabled()) return null;
  if (!isErpAiEligibleRoute(pathname)) return null;

  if (isOperator(user) && !(operatorPathAllowed(pathname) || isOperatorAiRoute(pathname))) {
    return null;
  }

  if (userCanUseSharedAgent(user)) {
    return AI_ASSISTANT_MODES.SHARED;
  }
  return null;
}

const PAGE_LABELS = {
  "/": "Dashboard",
  "/sales/orders": "Sales Orders",
  "/sales/customers": "Customers",
  "/sales/quotations": "Quotations",
  "/sales/invoices": "Invoices",
  "/production/work-orders": "Production / Work Orders",
  "/production/dashboard": "Production Dashboard",
  "/inventory": "Inventory",
  "/store-manager/dashboard": "Store Dashboard",
  "/store/reports": "Store Reports",
  "/hr/dashboard": "HR Dashboard",
  "/accounts/dashboard": "Accounts Dashboard",
  "/quality/dashboard": "Quality Dashboard",
};

/** Non-sensitive page label for optional assistant context (pathname only). */
export function erpPageContextLabel(pathname) {
  const path = normalizePath(pathname);
  if (PAGE_LABELS[path]) return PAGE_LABELS[path];
  const parts = path.split("/").filter(Boolean);
  if (!parts.length) return "Dashboard";
  const section = parts[0].replace(/-/g, " ");
  const page = parts[1] ? parts[1].replace(/-/g, " ") : section;
  return `${section} / ${page}`.replace(/\b\w/g, (c) => c.toUpperCase());
}
