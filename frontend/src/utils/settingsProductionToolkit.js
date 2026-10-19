/** Toolkit chrome — Production Manager Settings (Process Checklist alignment, mtk-theme--navy). */

import { isAdmin, isProductionManager } from "../config/permissions";

export const SETTINGS_PRODUCTION_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

export function useProductionManagerSettingsToolkit(user) {
  return Boolean(user && isProductionManager(user) && !isAdmin(user));
}

export function formatSettingsToolkitHeroDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "long",
  });
}
