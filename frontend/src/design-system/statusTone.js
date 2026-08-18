/**
 * Map business status strings → semantic badge tones.
 * Use with StatusBadge `tone` prop or Table statusBadge.
 */

const EXACT = {
  completed: "success",
  complete: "success",
  approved: "success",
  success: "success",
  paid: "success",
  delivered: "success",
  active: "success",
  resolved: "success",
  running: "success",
  confirmed: "success",
  packed: "success",
  invoiced: "success",

  in_progress: "info",
  processing: "info",
  open: "info",
  assigned: "info",
  planned: "neutral",

  pending: "warning",
  draft: "neutral",
  on_hold: "warning",
  hold: "warning",
  medium: "warning",
  maintenance: "warning",
  overdue: "warning",
  warning: "warning",

  rejected: "danger",
  failed: "danger",
  error: "danger",
  cancelled: "danger",
  canceled: "danger",
  critical: "danger",
  high: "danger",
  stopped: "danger",
  down: "danger",
};

export function resolveStatusTone(value) {
  if (value == null || value === "") return "neutral";
  const raw =
    typeof value === "object"
      ? value.tone || value.status || value.label || value.name || value.id || ""
      : value;
  const key = String(raw).toLowerCase().replace(/\s+/g, "_").replace(/-/g, "_");
  if (EXACT[key]) return EXACT[key];
  if (/complete|approve|success|paid|deliver|confirm|pack|invoice/.test(key)) return "success";
  if (/progress|process|assign|running|info|check/.test(key)) return "info";
  if (/pending|hold|wait|medium|overdue|warn|plan/.test(key)) return "warning";
  if (/reject|fail|error|cancel|critical|high|stop|danger|shortage/.test(key)) return "danger";
  return "neutral";
}

export default resolveStatusTone;
