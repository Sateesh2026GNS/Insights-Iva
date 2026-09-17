import { isAiCopilotEnabled, isOperatorAiRoute } from "./aiCopilot";
import {
  isAdmin,
  isOperator,
  userCanAccess,
} from "../config/permissions";
import { operatorPathAllowed } from "../config/rbacNavFilters";

export const AI_ASSISTANT_MODES = {
  OPERATOR: "operator",
  REGISTRY: "registry",
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

/** Backend `/api/agent/chat` — inventory or sales module (role-filtered tools server-side). */
export function userCanUseRegistryAgent(user) {
  if (!user) return false;
  if (isAdmin(user)) return true;
  return userCanAccess(user, "inventory") || userCanAccess(user, "sales");
}

/**
 * Which assistant to mount in the app shell (single instance, no per-page duplication).
 * @returns {'operator'|'registry'|null}
 */
export function resolveErpAiAssistantMode(user, pathname) {
  if (!user || !isAiCopilotEnabled()) return null;
  if (!isErpAiEligibleRoute(pathname)) return null;

  if (isOperator(user) && (operatorPathAllowed(pathname) || isOperatorAiRoute(pathname))) {
    return AI_ASSISTANT_MODES.OPERATOR;
  }
  if (userCanUseRegistryAgent(user)) {
    return AI_ASSISTANT_MODES.REGISTRY;
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
