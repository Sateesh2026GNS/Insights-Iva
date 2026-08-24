/**
 * Post-login dashboard path by role.
 * JWT is issued only after successful login; then redirect here.
 */
export function getDashboardPathForRole(role) {
  const name = String(role || "").trim().toLowerCase();

  if (name.includes("super admin") || name === "gns super admin") {
    return "/gns-admin";
  }
  if (name.includes("store manager")) {
    return "/inventory/dashboard";
  }
  if (name.includes("hr manager")) {
    return "/hr";
  }
  if (name.includes("sales")) {
    return "/sales/dashboard";
  }
  if (name.includes("accountant") || name.includes("billing")) {
    return "/accounts";
  }
  if (name.includes("operator")) {
    return "/production/operator-jobs";
  }
  if (name.includes("production manager")) {
    return "/production/planning";
  }
  if (name.includes("quality")) {
    return "/quality";
  }
  if (name.includes("packing") || name.includes("dispatch")) {
    return "/sales/dispatch";
  }
  if (name === "admin" || name.includes("admin")) {
    return "/";
  }
  return "/";
}
