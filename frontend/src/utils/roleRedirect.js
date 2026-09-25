/**
 * Post-login dashboard path by role.
 * Admin uses the ERP reference dashboard at `/`; other roles land on their dedicated module home.
 */

import { isQualityTeam } from "../config/permissions";

/** Canonical Accounts module home (must match AppRoutes + sidebar). */
export const ACCOUNTS_DASHBOARD_PATH = "/accounts/dashboard";

/** Role-aware dashboard route for Quality Control (renders the quality module dashboard). */
export const QUALITY_CONTROL_LANDING_PATH = "/dashboard";

/** Canonical Sales module home (must match AppRoutes + sidebar). */
export const SALES_DASHBOARD_PATH = "/sales";

/** Canonical Production Manager module home (must match AppRoutes + PM sidebar). */
export const PRODUCTION_DASHBOARD_PATH = "/production/dashboard";

function roleNamesLower(roleOrUser) {
  if (!roleOrUser) return [];
  if (typeof roleOrUser === "object") {
    const active = String(roleOrUser.role_name || roleOrUser.role || "").trim();
    if (active) {
      return [active.toLowerCase()];
    }
    if (Array.isArray(roleOrUser.roles)) {
      return roleOrUser.roles
        .map((r) => (typeof r === "object" ? r?.name : String(r || "")))
        .map((r) => String(r).trim().toLowerCase())
        .filter(Boolean);
    }
    return [];
  }
  return [String(roleOrUser).trim().toLowerCase()].filter(Boolean);
}

/** Merge the role selected at login into the API user payload (authoritative for landing). */
export function withLoginRole(user, selectedRole) {
  const role = String(selectedRole || "").trim();
  if (!user || typeof user !== "object") {
    if (!role) return null;
    return { role, role_name: role };
  }
  const resolved = user.role || user.role_name || role;
  const resolvedName = user.role_name || user.role || role;
  return { ...user, role: resolved, role_name: resolvedName };
}

function isAccountsPrimaryRole(name) {
  if (!name) return false;
  if (name.includes("accountant")) return true;
  if (name === "accounts" || name.startsWith("accounts ")) return true;
  if (name.includes("finance manager")) return true;
  if (name === "billing" || name.includes("billing")) return true;
  if (name === "account") return true;
  return false;
}

export function getDashboardPathForRole(roleOrUser) {
  if (typeof roleOrUser === "object" && roleOrUser && isQualityTeam(roleOrUser)) {
    return QUALITY_CONTROL_LANDING_PATH;
  }

  const names = roleNamesLower(roleOrUser);
  const name = names[0] || "";

  if (names.some((n) => n.includes("super admin") || n === "gns super admin")) {
    return "/gns-admin";
  }
  if (names.some((n) => n === "admin" || n === "administrator")) {
    return "/";
  }
  if (names.some((n) => n.includes("hr"))) {
    return "/hr";
  }
  if (names.some((n) => n.includes("sales"))) {
    return SALES_DASHBOARD_PATH;
  }
  if (names.some((n) => n.includes("store"))) {
    return "/inventory/dashboard";
  }
  if (names.some((n) => isAccountsPrimaryRole(n))) {
    return ACCOUNTS_DASHBOARD_PATH;
  }
  if (names.some((n) => n.includes("quality") || n === "qa" || n === "qc")) {
    return QUALITY_CONTROL_LANDING_PATH;
  }
  if (names.some((n) => n.includes("purchase") || n.includes("procurement"))) {
    return "/procurement";
  }
  if (names.some((n) => n === "operator")) {
    return "/my-job-cards";
  }
  if (names.some((n) => n.includes("production"))) {
    return PRODUCTION_DASHBOARD_PATH;
  }

  if (isAccountsPrimaryRole(name)) {
    return ACCOUNTS_DASHBOARD_PATH;
  }

  return "/";
}
