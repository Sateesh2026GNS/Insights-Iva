/** Deep links from Accounts Dashboard to existing list pages (query filters). */

export const ACCOUNTS_ROUTES = {
  dashboard: "/accounts/dashboard",
  settings: "/accounts/settings",
  receivables: "/finance/accounts-receivable",
  payables: "/accounts/accounts-payable",
  payments: "/finance/payment-tracking",
  invoices: "/sales/invoices",
  ledger: "/accounts/ledger",
  journal: "/accounts/journal-entries",
  expenses: "/accounts/expenses",
  bankRecon: "/accounts/bank-reconciliation",
  reports: "/accounts/reports",
  gst: "/accounts/gst",
};

export function receivablesLink(focus) {
  if (!focus) return ACCOUNTS_ROUTES.receivables;
  return `${ACCOUNTS_ROUTES.receivables}?focus=${encodeURIComponent(focus)}`;
}

export function payablesLink(focus) {
  if (!focus) return ACCOUNTS_ROUTES.payables;
  return `${ACCOUNTS_ROUTES.payables}?focus=${encodeURIComponent(focus)}`;
}

export function paymentsLink(focus) {
  if (!focus) return ACCOUNTS_ROUTES.payments;
  return `${ACCOUNTS_ROUTES.payments}?focus=${encodeURIComponent(focus)}`;
}

export function invoicesLink({ payment, invoiceStatus } = {}) {
  const params = new URLSearchParams();
  if (payment) params.set("payment", payment);
  if (invoiceStatus) params.set("invoice_status", invoiceStatus);
  const q = params.toString();
  return q ? `${ACCOUNTS_ROUTES.invoices}?${q}` : ACCOUNTS_ROUTES.invoices;
}

export function ledgerAccountLink(accountName) {
  if (!accountName) return ACCOUNTS_ROUTES.ledger;
  return `${ACCOUNTS_ROUTES.ledger}?account=${encodeURIComponent(accountName)}`;
}

export function invoiceDetailLink(id) {
  return id ? `/sales/invoices/${id}` : ACCOUNTS_ROUTES.invoices;
}
