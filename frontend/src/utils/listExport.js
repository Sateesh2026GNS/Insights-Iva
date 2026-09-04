import { exportToExcel, exportToPdf } from "./exportUtils";

/**
 * Run a standard list-page export (PDF or Excel).
 * `data` should be pre-mapped flat rows; `columns` should have key + label only.
 */
export function runListExport(format, { data, columns, filename = "export", title }) {
  if (!Array.isArray(data) || data.length === 0) return;
  const cols = (columns || []).filter((c) => c?.key);
  if (!cols.length) return;

  if (format === "pdf") {
    exportToPdf(data, cols, title || filename, filename);
    return;
  }

  exportToExcel(data, cols, filename);
}
