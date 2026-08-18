import api from "./axiosConfig";

export const createSalesJobCard = (orderId, payload) =>
  api.post(`/manufacturing/workflow/sales-orders/${orderId}/job-card`, payload);

export const saveSalesJobCard = (orderId, payload) =>
  api.patch(`/manufacturing/workflow/sales-orders/${orderId}/job-card`, payload);

export const getSalesJobCard = (orderId) =>
  api.get(`/manufacturing/workflow/sales-orders/${orderId}/job-card`);

export const getWorkflowJobCards = (params = {}) =>
  api.get("/manufacturing/workflow/job-cards", { params });

export const getWorkflowContext = (orderId) =>
  api.get(`/manufacturing/workflow/sales-orders/${orderId}/context`);

export const backfillWorkflowStatuses = (dryRun = false) =>
  api.post("/manufacturing/workflow/backfill", null, { params: { dry_run: dryRun } });

export const getWorkflowHub = () => api.get("/manufacturing/workflow/hub");

export const getWorkflowQueue = (params = {}) =>
  api.get("/manufacturing/workflow/queue", { params });

export const confirmSalesOrderWorkflow = (orderId) =>
  api.post(`/manufacturing/workflow/sales-orders/${orderId}/confirm`);

export const getMaterialCheck = (orderId) =>
  api.get(`/manufacturing/workflow/sales-orders/${orderId}/material-check`);

export const submitMaterialCheck = (orderId, payload) =>
  api.post(`/manufacturing/workflow/sales-orders/${orderId}/material-check`, payload);

export const assignOperator = (workOrderId, payload) =>
  api.post(`/manufacturing/workflow/production/job-cards/${workOrderId}/assign-operator`, payload);

export const startProduction = (workOrderId) =>
  api.post(`/manufacturing/workflow/production/job-cards/${workOrderId}/start`);

export const updateProductionProgress = (workOrderId, payload) =>
  api.patch(`/manufacturing/workflow/production/job-cards/${workOrderId}/progress`, payload);

export const completeProduction = (workOrderId, payload = {}) =>
  api.post(`/manufacturing/workflow/production/job-cards/${workOrderId}/complete`, payload);

export const submitQualityCheck = (inspectionId, payload) =>
  api.post(`/manufacturing/workflow/quality/checks/${inspectionId}/approve`, payload);

export const completePacking = (orderId, payload) =>
  api.post(`/manufacturing/workflow/packing/${orderId}/complete`, payload);

export const createBillingInvoice = (orderId, payload = {}) =>
  api.post("/manufacturing/workflow/billing/invoices", payload, { params: { order_id: orderId } });
