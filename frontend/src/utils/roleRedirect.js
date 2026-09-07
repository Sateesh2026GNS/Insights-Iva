/**
 * Post-login dashboard path by role.
 * JWT is issued only after successful login; then redirect to the primary module home.
 */
export function getDashboardPathForRole(role) {
  const name = String(role || "").trim().toLowerCase();

  if (name.includes("super admin") || name === "gns super admin") {
    return "/gns-admin";
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
    return "/my-job-cards";
  }
  if (name.includes("production")) {
    return "/production";
  }

  // Admin and unknown roles — production hub is the default ERP landing.
  return "/production";
}
