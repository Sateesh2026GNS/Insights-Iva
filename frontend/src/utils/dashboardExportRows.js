/** Build tabular export rows from label/value pairs (dashboard KPIs). */
export function metricExportRows(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .filter((row) => row && row.label)
    .map((row) => ({
      metric: row.label,
      value: row.value == null || row.value === "" ? "—" : String(row.value),
    }));
}

export function objectExportRows(record, labels = {}) {
  if (!record || typeof record !== "object") return [];
  return Object.entries(record).map(([key, value]) => ({
    metric: labels[key] || key.replace(/_/g, " "),
    value: value == null ? "—" : String(value),
  }));
}
