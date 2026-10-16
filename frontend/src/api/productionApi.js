import api from "./axiosConfig";

function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return { ...res, data: body.data };
  }
  return res;
}

async function apiGet(url, config) {
  return unwrap(await api.get(url, config));
}

async function apiPost(url, data, config) {
  return unwrap(await api.post(url, data, config));
}

async function apiPatch(url, data, config) {
  return unwrap(await api.patch(url, data, config));
}

async function apiPut(url, data, config) {
  return unwrap(await api.put(url, data, config));
}

async function apiDelete(url, config) {
  return unwrap(await api.delete(url, config));
}

export const seedProducts = () => apiPost("/api/masters/products/seed").catch(() => ({ data: { status: "ok" } }));

export const getProducts = () => apiGet("/api/masters/products");

export const getProductionOrders = async () => {
  const res = await apiGet("/api/production/planning");
  return { ...res, data: res.data?.orders ?? res.data ?? [] };
};

export const getProductionPlanningSummary = () => apiGet("/api/production/planning/summary");

export const getProductionPlannerDashboard = (planDate) =>
  apiGet("/api/production/planner", {
    params: planDate ? { plan_date: planDate } : undefined,
  });

export const getProductionProductCostDashboard = (params = {}) =>
  apiGet("/api/production/toolkit/product-cost", { params });

export const getManufacturingToolkitDashboard = (toolkitId, params = {}) =>
  apiGet("/api/production/toolkit/dashboard", {
    params: { toolkit_id: toolkitId, ...params },
  });

export const listManufacturingIssues = (params = {}) =>
  apiGet("/api/production/toolkit/issues", { params });

export const createManufacturingIssue = (payload) =>
  apiPost("/api/production/toolkit/issues", payload);

export const updateManufacturingIssue = (issueId, payload) =>
  apiPatch(`/api/production/toolkit/issues/${issueId}`, payload);

export const assignManufacturingIssue = (issueId, payload) =>
  apiPost(`/api/production/toolkit/issues/${issueId}/assign`, payload);

export const transitionManufacturingIssueStatus = (issueId, payload) =>
  apiPost(`/api/production/toolkit/issues/${issueId}/status`, payload);

export const listSafetyIncidents = (params = {}) =>
  apiGet("/api/production/toolkit/safety-incidents", { params });

export const createSafetyIncidentToolkit = (payload) =>
  apiPost("/api/production/toolkit/safety-incidents", payload);

export const updateSafetyIncidentToolkit = (incidentId, payload) =>
  apiPatch(`/api/production/toolkit/safety-incidents/${incidentId}`, payload);

export const assignSafetyIncidentInvestigation = (incidentId, payload) =>
  apiPost(`/api/production/toolkit/safety-incidents/${incidentId}/assign`, payload);

export const recordSafetyIncidentInvestigation = (incidentId, payload) =>
  apiPost(`/api/production/toolkit/safety-incidents/${incidentId}/investigation`, payload);

export const transitionSafetyIncidentStatus = (incidentId, payload) =>
  apiPost(`/api/production/toolkit/safety-incidents/${incidentId}/status`, payload);

export const listProcessChecklistItems = (params = {}) =>
  apiGet("/api/production/toolkit/process-checklist/items", { params });

export const createProcessChecklistItem = (payload) =>
  apiPost("/api/production/toolkit/process-checklist/items", payload);

export const updateProcessChecklistItem = (itemId, payload) =>
  apiPatch(`/api/production/toolkit/process-checklist/items/${itemId}`, payload);

export const assignProcessChecklistItem = (itemId, payload) =>
  apiPost(`/api/production/toolkit/process-checklist/items/${itemId}/assign`, payload);

export const verifyProcessChecklistItem = (itemId, payload) =>
  apiPost(`/api/production/toolkit/process-checklist/items/${itemId}/verify`, payload);

export const approveProcessChecklistItem = (itemId, payload) =>
  apiPost(`/api/production/toolkit/process-checklist/items/${itemId}/approve`, payload);

export const transitionProcessChecklistStatus = (itemId, payload) =>
  apiPost(`/api/production/toolkit/process-checklist/items/${itemId}/status`, payload);

export const getProductionOrderDetail = (orderId) =>
  apiGet(`/api/production/planning/${orderId}`);

export const getProductionOrderStartChecks = (orderId) =>
  apiGet(`/api/production/planning/${orderId}/start-checks`);

export const startProductionOrder = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/start`);

export const requestProductionOrderMaterials = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/request-materials`);

export const completeProductionOrder = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/complete`);

export const pauseProductionOrder = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/pause`);

export const createProductionOrder = (payload) =>
  apiPost("/api/production/planning", payload);

export const updateProductionOrder = (orderId, payload) =>
  apiPut(`/api/production/planning/${orderId}`, payload);

export const deleteProductionOrder = (orderId) =>
  apiDelete(`/api/production/planning/${orderId}`);

export const updateProductionOrderStatus = (orderId, status) =>
  apiPatch(`/api/production/planning/${orderId}/status`, null, { params: { status } });

export const updateProductionOrderPriority = (orderId, priority) =>
  apiPatch(`/api/production/planning/${orderId}/priority`, null, { params: { priority } });

export const updateProductionOrderMachine = (orderId, machineId) =>
  apiPatch(`/api/production/planning/${orderId}/machine`, null, { params: { machine_id: machineId } });

export const getMachines = async () => {
  try {
    return await apiGet("/api/masters/machines");
  } catch (primaryError) {
    try {
      const fallback = await apiGet("/api/production/allocation/machines");
      const rows = Array.isArray(fallback?.data) ? fallback.data : [];
      return {
        ...fallback,
        data: rows.map((machine) => ({
          ...machine,
          id: machine.id ?? machine.machine_id,
          name: machine.name ?? machine.machine_name,
        })),
      };
    } catch {
      throw primaryError;
    }
  }
};

export const getOperators = async () => {
  return apiGet("/api/production/operators");
};

export const getWorkOrders = (productionOrderId) =>
  apiGet("/api/production/work-orders", {
    params: productionOrderId ? { production_order_id: productionOrderId } : {},
  });

export const getWorkOrderSummary = (productionOrderId) =>
  apiGet("/api/production/work-orders/summary", {
    params: productionOrderId ? { production_order_id: productionOrderId } : {},
  });

export const getWorkOrderDetail = (workOrderId) =>
  apiGet(`/api/production/work-orders/${workOrderId}`);

export const getJobCards = () => apiGet("/api/production/job-cards");

export const getJobCard = (workOrderId) =>
  apiGet(`/api/production/job-cards/${workOrderId}`);

export const getWorkOrderStartChecks = (workOrderId) =>
  apiGet(`/api/production/work-orders/${workOrderId}/start-checks`);

export const startWorkOrder = (workOrderId) =>
  apiPost(`/api/production/work-orders/${workOrderId}/start`);

export const pauseWorkOrder = (workOrderId) =>
  apiPost(`/api/production/work-orders/${workOrderId}/pause`);

export const stopWorkOrder = (workOrderId) =>
  apiPost(`/api/production/work-orders/${workOrderId}/stop`);

export const completeWorkOrder = (workOrderId) =>
  apiPost(`/api/production/work-orders/${workOrderId}/complete`);

export const deleteWorkOrder = (workOrderId) =>
  apiDelete(`/api/production/work-orders/${workOrderId}`);

export const issueWorkOrderMaterials = (workOrderId, warehouseId, storeSalesOrderId) =>
  apiPost(`/api/production/work-orders/${workOrderId}/issue-materials`, null, {
    params: {
      ...(warehouseId ? { warehouse_id: warehouseId } : {}),
      ...(storeSalesOrderId ? { store_sales_order_id: storeSalesOrderId } : {}),
    },
  });

export const runMrp = (productId, quantity, createPurchaseRequest = true) =>
  apiPost("/api/production/mrp/run", null, {
    params: {
      product_id: productId,
      quantity,
      create_purchase_request: createPurchaseRequest,
    },
  });

export const createWorkOrder = (payload) =>
  apiPost("/api/production/work-orders", payload);

export const quickCreateWorkOrder = (payload) =>
  apiPost("/api/production/work-orders/quick", payload);

export const updateWorkOrder = (workOrderId, _tenantId, payload) =>
  apiPatch(`/api/production/work-orders/${workOrderId}`, payload);

export const updateMachineStatus = (machineId, status, idleReason) =>
  apiPatch(`/api/masters/machines/${machineId}/status`, {
    status,
    ...(idleReason ? { idle_reason: idleReason } : {}),
  });

export const getBatches = (_tenantId, workOrderId) =>
  apiGet("/api/production/batches", {
    params: workOrderId ? { work_order_id: workOrderId } : {},
  });

export const createBatch = (payload) => apiPost("/api/production/batches", payload);

export const getMachineSummary = () => apiGet("/api/masters/machines/summary");

export const getMachineDetail = (machineId) =>
  apiGet(`/api/masters/machines/${machineId}`);

export const createMachineFull = (payload) =>
  apiPost("/api/masters/machines", payload);

export const updateMachineFull = (machineId, payload) =>
  apiPut(`/api/masters/machines/${machineId}`, payload);

export const deleteMachine = (machineId) =>
  apiDelete(`/api/masters/machines/${machineId}`);

export const createMachine = (payload) =>
  apiPost("/api/masters/machines/simple", payload);

export const getMachineStatusEvents = (_tenantId, machineId) =>
  apiGet("/api/masters/machine-status", {
    params: machineId ? { machine_id: machineId } : {},
  });

export const createMachineStatusEvent = (payload) =>
  apiPost("/api/masters/machine-status", payload);

export const getDailyReports = (_tenantId, params = {}) =>
  apiGet("/api/production/daily-reports", { params: { ...params } });

export const createDailyReport = (payload) =>
  apiPost("/api/production/daily-reports", payload);

export const getAllocationSummary = () =>
  apiGet("/api/production/allocation/summary");

export const getAllocations = () =>
  apiGet("/api/production/allocation/rows");

export const getAllocationMachines = () =>
  apiGet("/api/production/allocation/machines");

export const assignAllocation = (payload) =>
  apiPost("/api/production/allocation/assign", payload);

export const getBatchSummary = () =>
  apiGet("/api/production/batches/summary");

export const getBatchesEnriched = () =>
  apiGet("/api/production/batches/items");

export const getBatchDetail = (batchId) =>
  apiGet(`/api/production/batches/${batchId}`);

export const getProductionHub = () =>
  apiGet("/api/production/hub");
