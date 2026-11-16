/** SMRT Reports Center category folders (UI labels match system catalog). */
export const REPORT_CENTER_CATEGORIES = [
  "Sales",
  "Inventory",
  "Inventory Valuation",
  "Receivables",
  "Payments Received",
  "Payables",
  "Purchases",
  "Activity",
  "Automation",
];

/** @deprecated alias — kept for older imports */
export const ZOHO_REPORT_CATEGORIES = REPORT_CENTER_CATEGORIES.map((key) => ({
  key,
  reportCategories: [key],
}));

export function zohoCategoryForReport(report) {
  return report?.category || "—";
}

export function reportMatchesZohoCategory(report, categoryKey) {
  return report?.category === categoryKey;
}

export function formatReportLastVisited(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatInr(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}
