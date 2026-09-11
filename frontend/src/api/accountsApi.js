import api from "./axiosConfig";

export const getAccountsDashboard = () => api.get("/accounts/dashboard");

export const getFinanceHub = () => api.get("/accounts/hub");

export const getAPSummary = () => api.get("/accounts/ap/summary");
export const getAPEnriched = () => api.get("/accounts/ap/enriched");

export const getARSummary = () => api.get("/accounts/ar/summary");
export const getAREnriched = () => api.get("/accounts/ar/enriched");

export const getPaymentSummary = () => api.get("/accounts/payments/summary");
export const getPaymentsEnriched = () => api.get("/accounts/payments/enriched");

export const getGLSummary = () => api.get("/accounts/gl/summary");
export const getGLEnriched = () => api.get("/accounts/gl/enriched");

export const getProfitLoss = (_tenantId, year, ytdMonth = 12) =>
  api.get("/accounts/profit-loss", {
    params: { year, ytd_month: ytdMonth },
  });

export const getProfitLossExtended = (year) =>
  api.get("/accounts/profit-loss/extended", { params: { year } });

export const getTaxReport = (_tenantId, year) =>
  api.get("/accounts/tax-report", {
    params: { year },
  });

export const getGSTExtended = (year, month, branch) =>
  api.get("/accounts/gst/extended", {
    params: { year, month: month || undefined, branch: branch || undefined },
  });

export const getGstSummary = (dateFrom, dateTo) =>
  api.get("/accounts/gst/summary", {
    params: { date_from: dateFrom, date_to: dateTo },
  });

export const getGstReturnView = (dateFrom, dateTo) =>
  api.get("/accounts/gst/return-view", {
    params: { date_from: dateFrom, date_to: dateTo },
  });

export const getGstGstr3b = (dateFrom, dateTo) =>
  api.get("/accounts/gst/gstr3b", {
    params: { date_from: dateFrom, date_to: dateTo },
  });

export const getGstVoucherRegister = (params = {}) =>
  api.get("/accounts/gst/voucher-register", { params });

export const getGstUncertain = (dateFrom, dateTo) =>
  api.get("/accounts/gst/uncertain", {
    params: { date_from: dateFrom, date_to: dateTo },
  });

export const listIncome = (_tenantId, year = null) =>
  api.get("/accounts/income", {
    params: { year },
  });

export const listExpenses = (_tenantId, year = null) =>
  api.get("/accounts/expenses", {
    params: { year },
  });

export const getExpense = (expenseId) => api.get(`/accounts/expenses/${expenseId}`);
export const createExpense = (payload) => api.post("/accounts/expenses", payload);
export const updateExpense = (expenseId, payload) =>
  api.put(`/accounts/expenses/${expenseId}`, payload);
export const deleteExpense = (expenseId) => api.delete(`/accounts/expenses/${expenseId}`);

export const createIncome = (payload) => api.post("/accounts/income", payload);

/** Extended finance reports (Balance Sheet, Trial Balance, Journals, Assets, etc.). */
export const getExtendedReports = (financialYear, month, branch) =>
  api.get("/accounts/extended-reports", {
    params: {
      financial_year: financialYear || undefined,
      month: month || undefined,
      branch: branch || undefined,
    },
  });

export const listJournalEntries = () => api.get("/accounts/journal-entries");

export const getJournalEntry = (entryId) => api.get(`/accounts/journal-entries/${entryId}`);

export const createJournalEntry = (payload) =>
  api.post("/accounts/journal-entries", payload);

export const updateJournalEntry = (entryId, payload) =>
  api.put(`/accounts/journal-entries/${entryId}`, payload);

export const deleteJournalEntry = (entryId) =>
  api.delete(`/accounts/journal-entries/${entryId}`);

export const listGLAccounts = () => api.get("/accounts/gl-accounts");

export const getGLAccount = (accountId) => api.get(`/accounts/gl-accounts/${accountId}`);

export const createGLAccount = (payload) =>
  api.post("/accounts/gl-accounts", payload);

export const updateGLAccount = (accountId, payload) =>
  api.put(`/accounts/gl-accounts/${accountId}`, payload);

export const deleteGLAccount = (accountId) =>
  api.delete(`/accounts/gl-accounts/${accountId}`);

export const seedGLAccounts = () => api.post("/accounts/gl-accounts/seed");

export const listFixedAssets = () => api.get("/accounts/fixed-assets");

export const getBalanceSheet = () => api.get("/accounts/balance-sheet");

export const createFixedAsset = (payload) =>
  api.post("/accounts/fixed-assets", payload);

export const getTenantPref = (key) => api.get(`/accounts/tenant-prefs/${key}`);

export const putTenantPref = (key, value) =>
  api.put(`/accounts/tenant-prefs/${key}`, { value });
