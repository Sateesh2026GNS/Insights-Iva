/** ERP list status labels for My Job Cards table and filters. */

export function erpListStatus(row) {
  const ws = String(row.workflow_status || "").toUpperCase();
  if (["COMPLETED", "INVOICED", "DELIVERED", "DISPATCHED"].includes(ws)) {
    return { label: "Completed", tone: "success" };
  }
  if (!ws || ["DRAFT", "PENDING", "SALES_ORDER_DRAFT", "MATERIAL_CHECK_PENDING"].includes(ws)) {
    return { label: "Not Started", tone: "neutral" };
  }
  return { label: "In Progress", tone: "progress" };
}

export const ERP_LIST_STATUS_FILTER_OPTIONS = [
  { value: "", label: "Select Status" },
  { value: "not_started", label: "Not Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
];

export function matchesErpListStatusFilter(row, filterValue) {
  if (!filterValue) return true;
  const { label } = erpListStatus(row);
  if (filterValue === "not_started") return label === "Not Started";
  if (filterValue === "in_progress") return label === "In Progress";
  if (filterValue === "completed") return label === "Completed";
  return true;
}
