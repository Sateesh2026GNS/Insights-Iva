import { isAdmin, isProductionManager, isStoreManager } from "./permissions";

/** Store Manager may open these manufacturing toolkit views on Production Planning (read-only inventory data). */
export const STORE_MANAGER_MANUFACTURING_TOOLKIT_IDS = [
  "inventory_register",
  "raw_material_tracker",
];

export function isStoreManufacturingToolkitUser(user) {
  if (!user || isAdmin(user) || isProductionManager(user)) return false;
  return isStoreManager(user);
}

/** `null` = all toolkits (production roles); otherwise allowed id list. */
export function manufacturingToolkitIdsForUser(user) {
  if (isStoreManufacturingToolkitUser(user)) {
    return STORE_MANAGER_MANUFACTURING_TOOLKIT_IDS;
  }
  return null;
}

export function storeManagerMayAccessProductionPlanning(user) {
  return isStoreManufacturingToolkitUser(user);
}

export function normalizeManufacturingToolkitId(user, toolkitId) {
  const allowed = manufacturingToolkitIdsForUser(user);
  if (!allowed) {
    return toolkitId || "daily_weekly_planner";
  }
  if (toolkitId && allowed.includes(toolkitId)) return toolkitId;
  return allowed[0];
}

export function userCanAccessManufacturingToolkit(user, toolkitId) {
  const allowed = manufacturingToolkitIdsForUser(user);
  if (!allowed) return true;
  return allowed.includes(toolkitId);
}
