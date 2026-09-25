import { exportToCsv, exportToExcel, exportToPdf } from "./exportUtils";

/** Client-side report formats supported via exportUtils. */
export const REPORT_EXPORT_FORMATS = [
  { id: "pdf", label: "PDF" },
  { id: "excel", label: "Excel" },
  { id: "text", label: "Text" },
  { id: "delimited", label: "Delimited" },
  { id: "msmoney", label: "MSMoney" },
];

export const DEFAULT_REPORT_EXPORT_COLUMNS = [
  { key: "metric", label: "Metric" },
  { key: "value", label: "Value" },
];

export async function runReportExport(format, { rows, columns, title, filename }) {
  if (!rows?.length) return false;
  if (format === "pdf") {
    await exportToPdf(rows, columns, title, filename);
    return true;
  }
  if (format === "excel") {
    await exportToExcel(rows, columns, filename);
    return true;
  }
  if (format === "text") {
    const headers = columns.map((c) => (typeof c.label === "string" ? c.label : c.key));
    const lines = [
      headers.join("\t"),
      ...rows.map((row) =>
        columns
          .map((c) => {
            const val = c.render && typeof c.render === "function" ? c.render(row) : row[c.key];
            return String(val ?? "");
          })
          .join("\t")
      ),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  }
  exportToCsv(rows, columns, `${filename}-${format}`);
  return true;
}
