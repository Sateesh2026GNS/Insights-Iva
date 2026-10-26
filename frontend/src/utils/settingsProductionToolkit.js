/** Toolkit chrome — all Settings pages, aligned with Process Checklist (mtk-theme--navy). */

export const SETTINGS_PRODUCTION_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

/** Process Checklist chrome is the settings design for every role. */
export function useProductionManagerSettingsToolkit() {
  return true;
}

export function formatSettingsToolkitHeroDate(date = new Date()) {
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "long",
  });
}
