/** Sales demo data and helpers. */

export const LEAD_STATUSES = ["new", "contacted", "qualified", "converted", "lost"];
export const LEAD_SOURCES = ["website", "referral", "trade_show", "cold_call", "linkedin", "exhibition"];
export const LEAD_INDUSTRIES = ["Manufacturing", "Automotive", "Pharma", "FMCG", "Construction", "Electronics"];
export const LEAD_REGIONS = ["North", "South", "East", "West", "Central"];
export const SALES_FLOW = [
  "Lead", "Opportunity", "Quotation", "Customer Approval", "Sales Order",
  "Production Planning", "Manufacturing", "Finished Goods Inventory",
  "Packing", "Dispatch", "Invoice", "Customer Payment", "Finance Ledger",
];

export const DEMO_LEAD_SUMMARY = { total_leads: 0, new_leads: 0, qualified_leads: 0, won_customers: 0, lost_leads: 0, conversion_rate: 0 };
export const DEMO_LEAD_LIST = [];

export const DEMO_QUOTE_SUMMARY = { total_quotations: 0, draft: 0, sent: 0, accepted: 0, rejected: 0, expired: 0 };
export const DEMO_QUOTE_LIST = [];

export const DEMO_SO_SUMMARY = { total_orders: 0, pending: 0, confirmed: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0, revenue: 0 };
export const DEMO_SO_LIST = [];

export const DEMO_DISPATCH_SUMMARY = { ready_to_dispatch: 0, packed: 0, in_transit: 0, delivered: 0, delayed: 0 };
export const DEMO_DISPATCH_LIST = [];

export const DEMO_INVOICE_SUMMARY = { total_invoices: 0, draft: 0, paid: 0, pending: 0, overdue: 0, revenue: 0 };
export const DEMO_INVOICE_LIST = [];

export const DEMO_SALES_HUB = {
  monthly_revenue: 0,
  total_orders: 0,
  pending_orders: 0,
  dispatch_pending: 0,
  outstanding_payments: 0,
  new_customers: 0,
  top_customers: [],
  sales_executive_performance: [],
  alerts: [],
};

export function formatInr(v) {
  if (v == null || v === "") return "₹0";
  const n = Number(v);
  if (Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function statusColor(s) {
  const m = {
    new: "bg-blue-100 text-blue-800", contacted: "bg-indigo-100 text-indigo-800",
    qualified: "bg-purple-100 text-purple-800", converted: "bg-green-100 text-green-800", lost: "bg-red-100 text-red-800",
    draft: "bg-slate-100 text-slate-700", sent: "bg-blue-100 text-blue-800", accepted: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800", expired: "bg-orange-100 text-orange-800",
    pending: "bg-amber-100 text-amber-800", confirmed: "bg-blue-100 text-blue-800", packed: "bg-indigo-100 text-indigo-800",
    shipped: "bg-teal-100 text-[var(--color-success)]", delivered: "bg-green-100 text-green-800", cancelled: "bg-red-100 text-red-800",
    in_transit: "bg-cyan-100 text-cyan-800", paid: "bg-green-100 text-green-800", overdue: "bg-red-100 text-red-800",
    partial: "bg-orange-100 text-orange-800",
  };
  return m[s] || "bg-slate-100 text-slate-700";
}

export function priorityColor(p) {
  const m = { urgent: "bg-red-100 text-red-800", high: "bg-orange-100 text-orange-800", medium: "bg-blue-100 text-blue-800", low: "bg-slate-100 text-slate-700" };
  return m[p] || m.medium;
}

export const KANBAN_COLUMNS = [
  { id: "new", label: "New", color: "border-blue-200 bg-blue-50" },
  { id: "contacted", label: "Contacted", color: "border-indigo-200 bg-indigo-50" },
  { id: "qualified", label: "Qualified", color: "border-purple-200 bg-purple-50" },
  { id: "converted", label: "Converted", color: "border-green-200 bg-green-50" },
  { id: "lost", label: "Lost", color: "border-red-200 bg-red-50" },
];
