/** Analytics demo data and helpers. */

export const FISCAL_YEARS = ["2027-28", "2026-27", "2025-26", "2024-25", "2023-24"];
export const QUARTERS = ["All Quarters", "Q1 (Apr-Jun)", "Q2 (Jul-Sep)", "Q3 (Oct-Dec)", "Q4 (Jan-Mar)"];
export const MONTHS = ["All Months", "April", "May", "June", "July", "August", "September", "October", "November", "December", "January", "February", "March"];
export const PLANTS = ["All Plants"];
export const DEPARTMENTS = ["All Departments"];
export const WAREHOUSES = ["All Warehouses"];
export const PRODUCTS = ["All Products"];
export const CUSTOMERS = ["All Customers"];
export const MACHINES = ["All Machines"];
export const CHART_COLORS = ["#2563EB", "#0d9488", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"];

export function formatInr(v) {
  if (v == null || v === "") return "₹0";
  const n = Number(v);
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function formatKpiValue(kpi) {
  if (!kpi) return "—";
  const v = kpi.value;
  if (kpi.format === "currency") return formatInr(v);
  if (kpi.format === "percent") return `${v}${kpi.unit || "%"}`;
  return `${Number(v).toLocaleString("en-IN")}${kpi.unit ? ` ${kpi.unit}` : ""}`;
}

export function changeColor(pct) {
  if (pct == null) return "text-slate-400";
  if (pct > 0) return "text-emerald-600";
  if (pct < 0) return "text-red-600";
  return "text-slate-500";
}

export function changeArrow(pct) {
  if (pct == null) return "";
  if (pct > 0) return "▲";
  if (pct < 0) return "▼";
  return "—";
}

export function alertSeverityClass(severity) {
  const m = {
    info: "bg-blue-50 border-blue-200 text-blue-800",
    warning: "bg-amber-50 border-amber-200 text-amber-800",
    success: "bg-emerald-50 border-emerald-200 text-emerald-800",
    danger: "bg-red-50 border-red-200 text-red-800",
  };
  return m[severity] || m.info;
}

export function exportCsv(filename, rows, headers) {
  const lines = [headers.join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => r[h] ?? "").join(",")));
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${filename}.csv`;
  a.click();
}

export function exportChartPng(chartId, filename) {
  const svg = document.querySelector(`#${chartId} svg`);
  if (!svg) { window.print(); return; }
  const svgData = new XMLSerializer().serializeToString(svg);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const img = new window.Image();
  img.onload = () => {
    canvas.width = img.width || 800;
    canvas.height = img.height || 400;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${filename || "chart"}.png`;
    a.click();
  };
  img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
}

export const DEMO_PRODUCTION = {
  kpis: [], alerts: [], benchmarks: [],
  monthly_production: [], production_trend: [], daily_output: [],
  shift_wise: [], machine_wise: [], product_wise: [],
  operator_performance: [], downtime_analysis: [],
  worker_score: 0, last_updated: null,
};

export const DEMO_INVENTORY = {
  kpis: [], alerts: [], stock_in_vs_out: [], warehouse_occupancy: [],
  abc_analysis: [], inventory_aging: [], monthly_consumption: [],
  value_trend: [], fast_moving: [], slow_moving: [], dead_stock: [],
  reorder_alerts: [], last_updated: null,
};

export const DEMO_SALES = {
  kpis: [], alerts: [], monthly_revenue: [], top_customers: [],
  top_products: [], regional_sales: [], sales_funnel: [],
  quotation_conversion: [], order_status: [], drill_revenue: [],
  last_updated: null,
};

export const DEMO_FINANCE = {
  kpis: [], alerts: [], revenue_vs_expense: [], cash_flow: [],
  profit_trend: [], expense_category: [], receivables_aging: [],
  payables_aging: [], gst_summary: [], drill_revenue: [],
  last_updated: null,
};

export const DEMO_EXECUTIVE = {
  kpis: [], alerts: [], revenue_trend: [], profit_margin: [],
  production_vs_sales: [], inventory_health: [], cash_position: [],
  ai_insights: [], last_updated: null,
};

export const DEMO_LIVE = {
  current_production: 0, active_machines: 0, total_machines: 0,
  todays_orders: 0, dispatches_today: 0, breakdown_alerts: 0,
  live_oee: 0, alerts: [], ai_insights: [], production_pulse: [],
  last_updated: null,
};

export const SOURCE_LINKS = {
  production: "/production",
  inventory: "/inventory",
  sales: "/sales",
  finance: "/accounts",
  quality: "/quality",
};
