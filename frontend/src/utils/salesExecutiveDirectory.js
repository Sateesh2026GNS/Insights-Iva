/** Display name for team-directory / user picker rows. */
export function executiveDisplayName(user) {
  if (!user) return "";
  return String(user.full_name || user.name || user.email || "").trim();
}

/**
 * Tenant users suitable for Assigned Executive on leads (sales-focused, non-HR).
 * Mirrors ShareToSalesTeamModal sales tab filtering.
 */
export function filterLeadExecutiveCandidates(users) {
  const list = Array.isArray(users) ? users : [];
  const active = list.filter((u) => u.is_active !== false);

  const nonHrUsers = active.filter((u) => {
    const role = String(u.role || "").toLowerCase().trim();
    const desig = String(u.designation || "").toLowerCase().trim();
    const dept = String(u.department || "").toLowerCase().trim();
    const isHr =
      role === "hr" ||
      role === "hr_manager" ||
      role.includes("hr_manager") ||
      role.includes("hr manager") ||
      role.includes("human resource") ||
      desig.includes("hr manager") ||
      desig.includes("human resource") ||
      desig === "hr" ||
      dept === "hr" ||
      dept === "human resources" ||
      dept.includes("human resource");
    return !isHr;
  });

  const salesFiltered = nonHrUsers.filter((u) => {
    const text = `${u.role || ""} ${u.designation || ""} ${u.department || ""}`.toLowerCase();
    return text.includes("sales");
  });

  const base = salesFiltered.length > 0 ? salesFiltered : nonHrUsers;
  return [...base].sort((a, b) =>
    executiveDisplayName(a).localeCompare(executiveDisplayName(b), undefined, { sensitivity: "base" })
  );
}

export function findExecutiveById(users, id) {
  if (id == null || id === "") return null;
  return users.find((u) => String(u.id) === String(id)) || null;
}

export function findExecutiveByName(users, name) {
  const target = String(name || "").trim().toLowerCase();
  if (!target) return null;
  return (
    users.find((u) => executiveDisplayName(u).toLowerCase() === target) ||
    users.find((u) => String(u.email || "").toLowerCase() === target) ||
    null
  );
}
