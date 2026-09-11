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

export const getProductionOrderDetail = (orderId) =>
  apiGet(`/api/production/planning/${orderId}`);

export const getProductionOrderStartChecks = (orderId) =>
  apiGet(`/api/production/planning/${orderId}/start-checks`);

export const startProductionOrder = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/start`);

export const completeProductionOrder = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/complete`);

export const pauseProductionOrder = (orderId) =>
  apiPost(`/api/production/planning/${orderId}/pause`);

export const createProductionOrder = (payload) =>
  apiPost("/api/production/planning", payload);

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

export const issueWorkOrderMaterials = (workOrderId, warehouseId) =>
  apiPost(`/api/production/work-orders/${workOrderId}/issue-materials`, null, {
    params: warehouseId ? { warehouse_id: warehouseId } : {},
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

export const updateMachineStatus = (machineId, _tenantId, status, idleReason) =>
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
