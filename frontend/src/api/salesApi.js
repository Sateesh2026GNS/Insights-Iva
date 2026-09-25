import api from "./axiosConfig";

export const getCustomers = () => api.get("/sales/customers");
export const createCustomer = (payload) => api.post("/sales/customers", payload);
export const updateCustomer = (customerId, payload) =>
  api.put(`/sales/customers/${customerId}`, payload);
export const deleteCustomer = (customerId) => api.delete(`/sales/customers/${customerId}`);

export const getSalesOrders = (_tenantId, status = null) =>
  api.get("/sales/sales-orders", { params: { status } });
export const getSalesOrdersEnriched = (params = {}) =>
  api.get("/sales/sales-orders/enriched", { params: salesDateParams(params) });
export const getSOSummary = () => api.get("/sales/sales-orders/summary");
export const getSalesOrderDetail = (orderId) => api.get(`/sales/sales-orders/${orderId}`);
export const createSalesOrder = (payload) => api.post("/sales/sales-orders", payload);
export const deleteSalesOrder = (orderId) =>
  api.delete(`/sales/sales-orders/${orderId}`, { skipGlobalError: true });
export const updateSalesOrderStatus = (orderId, status) =>
  api.patch(`/sales/sales-orders/${orderId}/status`, null, { params: { status } });
export const confirmSalesOrder = (orderId) =>
  api.post(`/sales/sales-orders/${orderId}/confirm`);
export const cancelSalesOrder = (orderId, payload) =>
  api.post(`/sales/sales-orders/${orderId}/cancel`, payload, { skipGlobalError: true });
export const updateSalesOrderDispatch = (orderId, flags) =>
  api.patch(`/sales/sales-orders/${orderId}/dispatch`, null, { params: flags });
export const confirmSalesOrderDelivery = (orderId) =>
  api.post(`/sales/sales-orders/${orderId}/confirm-delivery`);

export const getInvoices = (_tenantId, status = null, params = {}) =>
  api
    .get("/sales/invoices", { params: { payment_filter: status || undefined, page_size: 100, ...params } })
    .then((res) => {
      const data = res.data;
      if (Array.isArray(data)) return res;
      const items = (data?.items || []).map((row) => ({
        ...row,
        customer_name: row.buyer_name ?? row.customer_name,
        grand_total: row.amount ?? row.grand_total,
      }));
      return { ...res, data: items };
    });
export const getInvoicesV2 = (params = {}) => api.get("/sales/invoices/v2", { params });
export const getInvoicesEnriched = (params = {}) => api.get("/sales/invoices/v2", { params });
export const getInvoiceSummary = (params = {}) =>
  api.get("/sales/invoices/summary", { params });
export const getInvoiceDetail = (invoiceId) => api.get(`/sales/invoices/${invoiceId}`);
export const createInvoice = (payload) => api.post("/sales/invoices", payload);
export const updateInvoice = (invoiceId, payload) => api.put(`/sales/invoices/${invoiceId}`, payload);
export const deleteInvoice = (invoiceId) => api.delete(`/sales/invoices/${invoiceId}`);
export const cancelInvoice = deleteInvoice;

export const getInvoiceDocument = (invoiceId) => api.get(`/sales/invoices/${invoiceId}/document`);

export const downloadInvoicePdf = (invoiceId) =>
  api.get(`/sales/invoices/${invoiceId}/pdf`, { responseType: "blob" });

export const emailInvoice = (invoiceId, payload = {}) =>
  api.post(`/sales/invoices/${invoiceId}/email`, payload);

export const getPayments = (tenantIdOrParams = null, invoiceId = null) => {
  if (tenantIdOrParams !== null && typeof tenantIdOrParams === "object") {
    return api.get("/sales/payments", { params: tenantIdOrParams });
  }
  return api.get("/sales/payments", {
    params: { invoice_id: invoiceId || undefined },
  });
};
export const getPayment = (paymentId) => api.get(`/sales/payments/${paymentId}`);
export const createPayment = (payload, idempotencyKey = null) =>
  api.post("/sales/payments", payload, {
    headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : undefined,
  });
export const updatePayment = (paymentId, payload) =>
  api.put(`/sales/payments/${paymentId}`, payload);
export const deletePayment = (paymentId) => api.delete(`/sales/payments/${paymentId}`);

export const getLeads = (status = null) => api.get("/sales/leads", { params: { status } });
export const getLeadSummary = () => api.get("/sales/leads/summary");
export const getLeadsEnriched = (params = {}) =>
  api.get("/sales/leads/enriched", {
    params: {
      ...(params.from_date ? { followup_from: params.from_date } : {}),
      ...(params.to_date ? { followup_to: params.to_date } : {}),
    },
  });
export const createLead = (payload) => api.post("/sales/leads", payload);
export const updateLeadStatus = (leadId, status) =>
  api.patch(`/sales/leads/${leadId}/status`, null, { params: { status } });
export const updateLead = (leadId, payload) => api.patch(`/sales/leads/${leadId}`, payload);
export const deleteLead = (leadId) => api.delete(`/sales/leads/${leadId}`);
export const convertLeadToQuotation = (leadId) =>
  api.post(`/sales/leads/${leadId}/convert-to-quotation`);
export const getLeadActivities = (leadId) =>
  api.get(`/sales/leads/${leadId}/activities`);
export const createLeadActivity = (leadId, payload) =>
  api.post(`/sales/leads/${leadId}/activities`, payload);

export const getQuotations = (status = null) =>
  api.get("/sales/quotations", { params: { status } });
export const getQuotationSummary = (params = {}) =>
  api.get("/sales/quotations/summary", { params: salesDateParams(params) });
export const getQuotationsEnriched = () => api.get("/sales/quotations/enriched");
export const getQuotation = (quoteId) => api.get(`/sales/quotations/${quoteId}`);
export const getQuotationDocument = (quoteId) => api.get(`/sales/quotations/${quoteId}/document`);
export const downloadQuotationPdf = (quoteId) =>
  api.get(`/sales/quotations/${quoteId}/pdf`, { responseType: "blob" });
export const createQuotation = (payload) => api.post("/sales/quotations", payload);
export const updateQuotation = (quoteId, payload) =>
  api.put(`/sales/quotations/${quoteId}`, payload);
export const deleteQuotation = (quoteId) => api.delete(`/sales/quotations/${quoteId}`);
export const cancelQuotation = (quoteId) =>
  api.patch(`/sales/quotations/${quoteId}/status`, null, { params: { status: "cancelled" } });
export const updateQuotationStatus = (quoteId, status) =>
  api.patch(`/sales/quotations/${quoteId}/status`, null, { params: { status } });
export const convertQuotationToSalesOrder = (quoteId, payload = {}) =>
  api.post(`/sales/quotations/${quoteId}/convert-to-so`, payload);

export const getSalesOrderTraceability = (orderId) =>
  api.get(`/sales/sales-orders/${orderId}/traceability`);

export const getSalesOrderWorkflow = (orderId) =>
  api.get(`/sales/sales-orders/${orderId}/workflow`);

export const getManufacturingWorkflowBoard = () => api.get("/sales/workflow/board");

function salesDateParams({ from_date, to_date } = {}) {
  const params = {};
  if (from_date) params.from_date = from_date;
  if (to_date) params.to_date = to_date;
  return params;
}

export const getSalesHub = (params = {}) => api.get("/sales/hub", { params: salesDateParams(params) });

/** Daily sales activity for the authenticated user (YYYY-MM-DD). */
export const getSalesMyWork = (params = {}) =>
  api.get("/sales/my-work", { params: params.date ? { date: params.date } : {} });

/** Sales Manager reports — tenant-scoped via sales module (not generic analytics). */
export const getSalesReportsSummary = (year = null) =>
  api.get("/sales/reports/summary", { params: year ? { year } : {} });
