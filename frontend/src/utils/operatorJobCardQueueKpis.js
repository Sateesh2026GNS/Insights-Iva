/** KPI strip for the operator job card queue, counted from loaded rows. */

import { erpListStatus } from "./jobCardListStatus";

export function computeOperatorJobCardKpis(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let assigned = 0;
  let quality = 0;
  let completed = 0;
  let notStarted = 0;
  let inProgress = 0;

  for (const row of list) {
    const workflow = String(row?.workflow_status || "").toUpperCase();
    const label = erpListStatus(row).label;
    if (workflow === "PRODUCTION_ASSIGNED") assigned += 1;
    else if (workflow === "QUALITY_CHECK_PENDING" || label === "Quality Check") quality += 1;
    else if (workflow === "PRODUCTION_COMPLETED" || label === "Completed") completed += 1;
    else if (!workflow || label === "Not Started") notStarted += 1;
    else inProgress += 1;
  }

  return [
    { label: "Total Job Cards", value: String(list.length), tone: "blue", icon: "JC" },
    { label: "Assigned", value: String(assigned), tone: "green", icon: "A" },
    { label: "In Progress", value: String(inProgress), tone: "orange", icon: "IP" },
    { label: "Not Started", value: String(notStarted), tone: "red", icon: "NS" },
    { label: "Quality Check", value: String(quality), tone: "purple", icon: "Q" },
    { label: "Completed", value: String(completed), tone: "teal", icon: "C" },
  ];
}
