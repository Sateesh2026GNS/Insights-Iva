/**
 * Post-login dashboard path by role.
 * Admin uses the ERP dashboard at `/`; other roles land on their module home.
 */
export function getDashboardPathForRole(role) {
  const name = String(role || "").trim().toLowerCase();

  if (name.includes("super admin") || name === "gns super admin") {
    return "/gns-admin";
  }
  if (name === "admin" || name === "administrator") {
    return "/";
  }
  if (name.includes("hr")) {
    return "/hr";
  }
  if (name.includes("sales")) {
    return "/sales";
  }
  if (name.includes("store")) {
    return "/inventory";
  }
  if (name.includes("accountant") || name === "account") {
    return "/accounts";
  }
  if (name.includes("quality")) {
    return "/quality";
  }
  if (name.includes("purchase") || name.includes("procurement")) {
    return "/procurement";
  }
  if (name === "operator") {
    return "/";
  }
  if (name.includes("production")) {
    return "/production";
  }

  return "/";
}
