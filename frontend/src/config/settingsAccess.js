/**
 * Granular Settings section RBAC — module required to view each section.
 * Keep aligned with backend PERMISSION_MATRIX and admin-only /api/settings/* guards.
 */

/** Map settings section id → RBAC module code required to view. */
export const SETTINGS_SECTION_MODULES = {
  "my-account": "settings",
  notifications: "settings",
  appearance: "settings",
  subscription: "settings",
  help: "settings",
  about: "settings",
  company: "admin",
  users: "admin",
  security: "admin",
  ai: "admin",
  audit: "admin",
  integrations: "admin",
  api: "admin",
  backup: "admin",
  "change-format": "admin",
  "invoice-settings": "admin",
  "sequence-reset": "admin",
  finance: "admin",
  documents: "admin",
  production: "production",
  "manufacturing-workflow": "production",
  inventory: "inventory",
  "expense-settings": "accounts",
};

/** Legacy URL segments → canonical section ids (subset used for path parsing). */
const LEGACY_SECTION_ALIASES = {
  "company-profile": "company",
  users: "users",
  teams: "users",
  permissions: "users",
  subscription: "subscription",
  alerts: "notifications",
  inventory: "inventory",
  "inventory-settings": "inventory",
  production: "production",
  gst: "finance",
  buyers: "integrations",
  finance: "finance",
  "change-format": "change-format",
  "format-settings": "change-format",
  "invoice-settings": "invoice-settings",
  "expense-settings": "expense-settings",
  "sequence-reset": "sequence-reset",
  "role-workflow": "manufacturing-workflow",
};

export function getSettingsSectionIdFromPath(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  if (path === "/settings") return null;
  if (!path.startsWith("/settings/")) return null;
  const segment = path.slice("/settings/".length).split("/")[0];
  return LEGACY_SECTION_ALIASES[segment] || segment;
}

export function getSettingsSectionModule(sectionId) {
  if (!sectionId) return "settings";
  return SETTINGS_SECTION_MODULES[sectionId] || "settings";
}
