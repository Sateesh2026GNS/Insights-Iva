/** Finance demo data and helpers. */

export const FINANCE_FLOW = [
  "Purchase Order", "Goods Receipt", "Vendor Bill", "Accounts Payable",
  "Payment", "General Ledger", "GST Update", "Profit & Loss", "Balance Sheet",
];

export const FINANCIAL_YEARS = ["2026-27", "2025-26", "2024-25", "2023-24"];
export const BRANCHES = ["Head Office", "Plant-1", "Plant-2", "Warehouse"];
export const COST_CENTERS = ["Production", "HR", "Sales", "Procurement", "Warehouse", "Administration"];
export const GST_REPORTS = ["GSTR-1", "GSTR-2B", "GSTR-3B", "GSTR-9", "HSN Summary", "SAC Summary"];

export const DEMO_AP_SUMMARY = {
  outstanding_payables: 0,
  due_this_week: 0,
  overdue_bills: 0,
  paid_this_month: 0,
  pending_approvals: 0,
  vendor_count: 0,
};

export const DEMO_AP_LIST = [];

export const DEMO_AR_SUMMARY = {
  total_receivables: 0,
  received_today: 0,
  overdue: 0,
  pending_collection: 0,
  credit_customers: 0,
  aging_0_30: 0,
  aging_31_60: 0,
  aging_61_90: 0,
  aging_90_plus: 0,
};

export const DEMO_AR_LIST = [];

export const DEMO_PAY_SUMMARY = {
  cash_received_today: 0,
  online_payments: 0,
  cash_payments: 0,
  bank_transfers: 0,
  failed_payments: 0,
  pending_payments: 0,
};

export const DEMO_PAY_LIST = [];

export const DEMO_GL_SUMMARY = {
  total_assets: 0,
  total_liabilities: 0,
  equity: 0,
  revenue: 0,
  expenses: 0,
  cash_balance: 0,
};

export const DEMO_GL_LIST = [];

export const DEMO_GST = {
  year: 0,
  sgst: 0,
  cgst: 0,
  igst: 0,
  total_gst: 0,
  taxable_value: 0,
  gst_payable: 0,
  gst_receivable: 0,
  monthly_collection: [],
  gst_trend: [],
  gst_by_customer: [],
  gst_by_product: [],
};

export const DEMO_PL = {
  year: 0,
  revenue: 0,
  gross_profit: 0,
  net_profit: 0,
  ebitda: 0,
  operating_cost: 0,
  manufacturing_cost: 0,
  inventory_cost: 0,
  monthly_revenue: [],
  expense_trend: [],
  profit_trend: [],
  revenue_vs_expense: [],
  department_cost: [],
  factory_cost: [],
  total_revenue: 0,
  total_expenses: 0,
  profit: 0,
  revenue_rows: [],
  expense_rows: [],
};

export const DEMO_FINANCE_HUB = {
  total_receivables: 0,
  outstanding_payables: 0,
  cash_balance: 0,
  monthly_revenue: 0,
  monthly_expenses: 0,
  net_profit: 0,
  gst_payable: 0,
  cash_flow_trend: [],
  revenue_trend: [],
  expense_trend: [],
  profit_trend: [],
  gst_trend: [],
  vendor_payments: [],
  customer_receipts: [],
  monthly_cost: [],
  department_cost: [],
  manufacturing_cost: [],
  budget_vs_actual: [],
  accounts_aging: [],
  alerts: [],
};

export const GL_PLANNED_FEATURES = [
  "Chart of Accounts", "Journal Entries", "Trial Balance", "Cost Center Allocation",
  "Bank Reconciliation", "Fixed Assets & Depreciation",
  "Budget vs Actual",
];

export function formatInr(v) {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return "—";
  return `₹${n.toLocaleString("en-IN")}`;
}

export function statusColor(s) {
  const m = {
    pending: "bg-amber-100 text-amber-800",
    due: "bg-orange-100 text-orange-800",
    overdue: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800",
    partial: "bg-blue-100 text-blue-800",
    completed: "bg-green-100 text-green-800",
    failed: "bg-red-100 text-red-800",
    sent: "bg-indigo-100 text-indigo-800",
    approved: "bg-green-100 text-green-800",
  };
  return m[s] || "bg-slate-100 text-slate-700";
}

export function agingColor(bucket) {
  const m = {
    "0-30": "bg-green-100 text-green-800",
    "31-60": "bg-amber-100 text-amber-800",
    "61-90": "bg-orange-100 text-orange-800",
    "90+": "bg-red-100 text-red-800",
  };
  return m[bucket] || "bg-slate-100 text-slate-700";
}
