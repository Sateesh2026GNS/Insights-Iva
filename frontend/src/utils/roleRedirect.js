/**
 * Post-login dashboard path by role.
 * Admin uses the ERP reference dashboard at `/`; other roles land on their dedicated module home.
 */
export function getDashboardPathForRole(roleOrUser) {
  let role = roleOrUser;
  if (roleOrUser && typeof roleOrUser === "object") {
    role =
      roleOrUser.role_name ||
      roleOrUser.role ||
      (Array.isArray(roleOrUser.roles) && roleOrUser.roles[0]
        ? typeof roleOrUser.roles[0] === "object"
          ? roleOrUser.roles[0].name
          : roleOrUser.roles[0]
        : "");
  }
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
    return "/inventory/dashboard";
  }
  if (name.includes("accountant") || name === "account") {
    return "/accounts";
  }
  if (name.includes("quality") || name === "qa" || name === "qc") {
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

  return "/";
}
