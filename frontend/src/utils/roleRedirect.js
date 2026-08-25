/**
 * Post-login dashboard path by role.
 * JWT is issued only after successful login; then redirect to their respective dashboard.
 */
export function getDashboardPathForRole(role) {
  const name = String(role || "").trim().toLowerCase();

  if (name.includes("super admin") || name === "gns super admin") {
    return "/gns-admin";
  }
  if (name.includes("store manager") || name.includes("inventory manager") || name.includes("warehouse manager")) {
    return "/inventory/dashboard";
  }
  if (name.includes("hr manager") || name.includes("human resources")) {
    return "/hr";
  }
  if (name.includes("sales")) {
    return "/sales/dashboard";
  }
  if (name.includes("accountant") || name.includes("billing") || name.includes("finance")) {
    return "/accounts";
  }
  if (name.includes("operator")) {
    return "/production/operator-jobs";
  }
  if (name.includes("quality") || name.includes("qc") || name.includes("qa")) {
    return "/quality";
  }
  if (name.includes("dispatch") || name.includes("packing")) {
    return "/sales/dispatch";
  }
  // Admin, Production Manager, Plant Manager, Operations, and all other users open the main Executive & Production Dashboard
  return "/";
}
