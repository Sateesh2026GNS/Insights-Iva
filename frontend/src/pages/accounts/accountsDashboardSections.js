export const ACCOUNTS_DASHBOARD_SECTIONS_KEY = "insights.accounts.dashboard.sections.v2";

export const ACCOUNTS_DASHBOARD_SECTIONS = [
  { id: "needs_attention", title: "Needs attention", description: "A short read of overdue balances and GST for this period.", defaultOn: true },
  { id: "sales_breakdown", title: "Sales breakdown", description: "Customers, products, collections, and invoice status for the selected period.", defaultOn: true },
  { id: "cash_and_bank", title: "Cash and bank accounts", description: "Balance of each cash and bank ledger account.", defaultOn: false },
  { id: "gst_summary", title: "GST summary", description: "Output tax, input credit, and net liability for the selected period.", defaultOn: false },
];

export function defaultSectionState() {
  return Object.fromEntries(ACCOUNTS_DASHBOARD_SECTIONS.map((s) => [s.id, Boolean(s.defaultOn)]));
}

export function loadSectionState() {
  if (typeof window === "undefined") return defaultSectionState();
  try {
    const raw = window.localStorage.getItem(ACCOUNTS_DASHBOARD_SECTIONS_KEY);
    if (!raw) return defaultSectionState();
    return { ...defaultSectionState(), ...JSON.parse(raw) };
  } catch {
    return defaultSectionState();
  }
}

export function saveSectionState(state) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(ACCOUNTS_DASHBOARD_SECTIONS_KEY, JSON.stringify(state));
  }
}
