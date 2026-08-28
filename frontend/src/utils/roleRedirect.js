/**
 * Post-login dashboard path by role.
 * JWT is issued only after successful login; then redirect to their respective dashboard.
 */
export function getDashboardPathForRole(role) {
  const name = String(role || "").trim().toLowerCase();

  if (name.includes("super admin") || name === "gns super admin") {
    return "/gns-admin";
  }

  // All ERP roles (Admin, Production Manager, Sales Manager, Store Manager, Accountant, Operator, HR Manager, Quality, etc.)
  // open the main role-based Dashboard at "/"
  return "/";
}
