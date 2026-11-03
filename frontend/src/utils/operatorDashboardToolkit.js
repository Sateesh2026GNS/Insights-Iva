/** Operator Dashboard — toolkit chrome aligned with Team Capacity (mtk-theme--teal). */

import { operatorPathAllowed } from "../config/rbacNavFilters";

export const OPERATOR_DASHBOARD_TOOLKIT_SUBTITLE =
  "Manufacturing Production Planning & Factory Control Toolkit";

export const OPERATOR_DASHBOARD_TAGLINE = "Assigned Work · Record Output · Track the Machine";

/** Same tone cycle as Team Capacity KPI chips. */
export const OPERATOR_DASHBOARD_KPI_TONES = ["blue", "green", "orange", "purple", "red", "teal", "yellow"];

const OPERATOR_DASHBOARD_KPI_ICONS = {
  "my-work-orders": "WO",
  "todays-target": "T",
  "completed-today": "C",
  "operator-in-progress": "IP",
  "pending-tasks": "P",
  "assigned-machine": "M",
  "machine-status": "S",
  "material-availability": "Mat",
  "quality-checks-pending": "QC",
};

export function operatorDashboardKpiTone(index) {
  return OPERATOR_DASHBOARD_KPI_TONES[index % OPERATOR_DASHBOARD_KPI_TONES.length];
}

export function operatorDashboardKpiIcon(card) {
  const id = String(card?.id || "").trim();
  if (OPERATOR_DASHBOARD_KPI_ICONS[id]) return OPERATOR_DASHBOARD_KPI_ICONS[id];
  const label = String(card?.title || "").trim();
  return label ? label.charAt(0).toUpperCase() : "•";
}

/** Pages an operator can open from a KPI. Quality checks are not an operator action. */
const OPERATOR_KPI_DESTINATIONS = {
  "my-work-orders": "/my-job-cards",
  "todays-target": "/my-job-cards",
  "completed-today": "/my-job-cards",
  "operator-in-progress": "/my-job-cards",
  "pending-tasks": "/my-job-cards",
  "assigned-machine": "/production/my-machine",
  "machine-status": "/production/my-machine",
  "material-availability": "/my-job-cards",
  "quality-checks-pending": null,
};

export function operatorDashboardKpiHref(card) {
  const id = String(card?.id || "").trim();
  if (id === "quality-checks-pending") return null;
  const fromApi = String(card?.link || "").trim();
  if (fromApi) {
    const path = fromApi.split("?")[0].split("#")[0];
    if (operatorPathAllowed(path)) return fromApi;
  }
  if (Object.prototype.hasOwnProperty.call(OPERATOR_KPI_DESTINATIONS, id)) {
    return OPERATOR_KPI_DESTINATIONS[id];
  }
  return null;
}
