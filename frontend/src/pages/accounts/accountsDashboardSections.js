export const ACCOUNTS_DASHBOARD_SECTIONS_KEY = "insights.accounts.dashboard.sections.v1";

export const ACCOUNTS_DASHBOARD_SECTIONS = [
  { id: "needs_attention", title: "Needs attention", description: "A written read of the cards you have switched on.", defaultOn: true },
  { id: "overview", title: "Overview", description: "Receivables, payables, cash and bank, and GST in one band.", defaultOn: true },
  { id: "sales_purchases", title: "Sales and Purchases", description: "Month-by-month sales against purchases.", defaultOn: true },
  { id: "top_expenses", title: "Top Expenses", description: "Where the money went, by category.", defaultOn: false },
  { id: "income_expense", title: "Income and Expense", description: "Income against expense for the selected period.", defaultOn: false },
  { id: "aging_summary", title: "Aging Summary", description: "How overdue your receivables or payables are.", defaultOn: true },
  { id: "cash_flow", title: "Cash Flow", description: "Opening to closing cash, split by activity.", defaultOn: false },
  { id: "cash_and_bank", title: "Cash and Bank", description: "Balance per account. Already counted in Overview.", defaultOn: false },
  { id: "account_watchlist", title: "Account Watchlist", description: "Balances for the accounts you pin, in the order you pin them.", defaultOn: false },
  { id: "gst_summary", title: "GST Summary", description: "The CGST / SGST / IGST / Cess split behind the Overview figure.", defaultOn: false },
  { id: "sales_breakdown", title: "Sales Breakdown", description: "Your best customers and items for the period.", defaultOn: true },
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
