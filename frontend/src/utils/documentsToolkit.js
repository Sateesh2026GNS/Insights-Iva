/** KPI strip — Documents library (Department Operating Plan toolkit alignment). */

export const DOCUMENTS_TOOLKIT_KPIS = [
  { label: "Total Documents", tone: "blue", icon: "D", field: "total_documents" },
  { label: "PDF Files", tone: "red", icon: "P", field: "pdf_files" },
  { label: "Images", tone: "purple", icon: "I", field: "image_files" },
  { label: "Excel Files", tone: "green", icon: "X", field: "excel_files" },
  { label: "Word Files", tone: "teal", icon: "W", field: "word_files" },
  { label: "Recent (7d)", tone: "orange", icon: "+", field: "recent_uploads_7d" },
];

export function formatDocumentsKpiValue(summary, kpi, { loading = false } = {}) {
  if (loading) return "—";
  if (!summary) return "0";
  const raw = summary[kpi.field];
  if (raw == null || raw === "") return "0";
  return typeof raw === "number" ? raw.toLocaleString() : String(raw);
}
