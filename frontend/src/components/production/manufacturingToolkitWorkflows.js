import { apiErrorMessage } from "../../utils/apiError";

export function incidentListParams(filter) {
  const params = { page: 1, page_size: 50, sort_by: "incident_date", sort_dir: "desc" };
  if (filter === "open") params.open_only = true;
  if (filter === "high") params.severity = "high";
  return params;
}

export function issueListParams(filter) {
  const params = { page: 1, page_size: 50, sort_by: "raised_date", sort_dir: "desc" };
  if (filter === "open") params.status = "open";
  if (filter === "high") params.priority = "high";
  if (filter === "critical") params.priority = "critical";
  return params;
}

export function checklistListParams(filter) {
  const params = { page: 1, page_size: 50, sort_by: "due_date", sort_dir: "asc" };
  if (filter === "overdue") params.overdue_only = true;
  if (filter === "pending") params.pending_only = true;
  return params;
}

export function toolkitRegisterEmptyMessage(kind, loaded, error, total) {
  if (error) return error;
  if (!loaded) return `Loading ${kind} register…`;
  if (total === 0) return `No ${kind} records in this view.`;
  return null;
}

export function toolkitActionError(err, fallback) {
  return apiErrorMessage(err, fallback);
}

export function incidentsEligibleForActions(items) {
  return (items || []).filter((i) => i.status === "open" || i.status === "under_investigation");
}

export function issuesEligibleForActions(items) {
  return (items || []).filter((i) => ["open", "in_progress", "on_hold"].includes(i.status));
}

export function checklistEligibleForWork(items) {
  return (items || []).filter((i) => i.status === "pending" || i.status === "in_progress");
}

export function checklistEligibleForApproval(items) {
  return (items || []).filter((i) => i.status === "completed" && (i.verification_result || "").toLowerCase() === "pass");
}
