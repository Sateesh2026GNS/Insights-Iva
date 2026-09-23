/**
 * Post-login dashboard path by role.
 * Admin uses the ERP reference dashboard at `/`; other roles land on their dedicated module home.
 */

/** Canonical Accounts module home (must match AppRoutes + sidebar). */
export const ACCOUNTS_DASHBOARD_PATH = "/accounts/dashboard";

/** Canonical Sales module home (must match AppRoutes + sidebar). */
export const SALES_DASHBOARD_PATH = "/sales";

function roleNamesLower(roleOrUser) {
  if (!roleOrUser) return [];
  if (typeof roleOrUser === "object") {
    const fromUser = [];
    const active = String(
      roleOrUser.role_name || roleOrUser.role || ""
    ).trim();
    if (active) fromUser.push(active);
    if (Array.isArray(roleOrUser.roles)) {
      roleOrUser.roles.forEach((r) => {
        const name = typeof r === "object" ? r?.name : String(r || "");
        if (name) fromUser.push(name);
      });
    }
    return fromUser.map((r) => String(r).trim().toLowerCase()).filter(Boolean);
  }
  return [String(roleOrUser).trim().toLowerCase()].filter(Boolean);
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
    return "/quality";
  }
  if (names.some((n) => n.includes("purchase") || n.includes("procurement"))) {
    return "/procurement";
  }
  if (names.some((n) => n === "operator")) {
    return "/my-job-cards";
  }
  if (names.some((n) => n.includes("production"))) {
    return "/production";
  }

  if (isAccountsPrimaryRole(name)) {
    return ACCOUNTS_DASHBOARD_PATH;
  }

  return "/";
}
