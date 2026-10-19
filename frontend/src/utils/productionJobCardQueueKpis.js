/** KPI strip for Production Manager job card queue (derived from live queue rows). */

export function computeProductionJobCardKpis(rows) {
  const list = Array.isArray(rows) ? rows : [];
  let ready = 0;
  let assigned = 0;
  let inProgress = 0;
  let rework = 0;
  let bomPending = 0;

  for (const r of list) {
    const ws = String(r.workflow_status || "").toUpperCase();
    if (ws === "READY_FOR_PRODUCTION") ready += 1;
    else if (ws === "PRODUCTION_ASSIGNED") assigned += 1;
    else if (ws === "PRODUCTION_IN_PROGRESS") inProgress += 1;
    else if (ws === "PRODUCTION_REWORK" || ws === "QUALITY_REJECTED") rework += 1;
    else if (ws === "BOM_PENDING") bomPending += 1;
  }

  return [
    { label: "Total in Queue", value: String(list.length), unit: "Job Cards", tone: "blue", icon: "📋" },
    { label: "Ready for Production", value: String(ready), unit: "Orders", tone: "green", icon: "✓" },
    { label: "Assigned", value: String(assigned), unit: "Jobs", tone: "orange", icon: "A" },
    { label: "In Progress", value: String(inProgress), unit: "Active", tone: "purple", icon: "▶" },
    { label: "Rework / Rejected", value: String(rework), unit: "Items", tone: "red", icon: "!" },
    { label: "BOM Pending", value: String(bomPending), unit: "Orders", tone: "teal", icon: "B" },
  ];
}
