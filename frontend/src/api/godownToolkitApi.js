import api from "./axiosConfig";

export const getGodownSpace = () => api.get("/inventory/godown-toolkit/space");
export const saveGodownLayout = (warehouseId, payload) =>
  api.put(`/inventory/godown-toolkit/space/${warehouseId}`, payload);
export const getToolkitItems = (params) => api.get("/inventory/godown-toolkit/items", { params });
export const saveItemProfile = (itemId, payload) =>
  api.put(`/inventory/godown-toolkit/items/${itemId}/profile`, payload);
export const convertToolkitItem = (params) => api.get("/inventory/godown-toolkit/convert", { params });
export const getToolkitValuation = (params) => api.get("/inventory/godown-toolkit/valuation", { params });
export const getEoqInputs = (itemId) => api.get("/inventory/godown-toolkit/eoq/inputs", { params: { item_id: itemId } });
export const getEoqHistory = (params) => api.get("/inventory/godown-toolkit/eoq", { params });
export const saveEoq = (payload) => api.post("/inventory/godown-toolkit/eoq", payload);
export const getLabourEntries = (params) => api.get("/inventory/godown-toolkit/labour", { params });
export const createLabourEntry = (payload) => api.post("/inventory/godown-toolkit/labour", payload);
export const updateLabourEntry = (id, payload) => api.put(`/inventory/godown-toolkit/labour/${id}`, payload);
export const getTruckPlans = (params) => api.get("/inventory/godown-toolkit/truck-plans", { params });
export const createTruckPlan = (payload) => api.post("/inventory/godown-toolkit/truck-plans", payload);
export const getLossRecords = () => api.get("/inventory/godown-toolkit/losses");
export const createLossRecord = (payload) => api.post("/inventory/godown-toolkit/losses", payload);
export const getStorageQuotations = (params) => api.get("/inventory/godown-toolkit/quotations", { params });
export const createStorageQuotation = (payload) => api.post("/inventory/godown-toolkit/quotations", payload);
export const updateStorageQuotation = (id, payload) => api.put(`/inventory/godown-toolkit/quotations/${id}`, payload);
export const setStorageQuotationStatus = (id, status) =>
  api.patch(`/inventory/godown-toolkit/quotations/${id}/status`, { status });
export const getGatePasses = (params) => api.get("/inventory/godown-toolkit/gate-passes", { params });
export const createGatePass = (payload) => api.post("/inventory/godown-toolkit/gate-passes", payload);
export const setGatePassStatus = (id, status) =>
  api.patch(`/inventory/godown-toolkit/gate-passes/${id}/status`, { status });
export const getGodownToolkitDashboard = () => api.get("/inventory/godown-toolkit/dashboard");

export function toolkitError(error) {
  const detail = error?.response?.data?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (Array.isArray(detail)) {
    return detail.map((row) => (typeof row === "string" ? row : row?.msg || "Invalid value")).join(" ");
  }
  return "The request failed. Check the connection and try again.";
}

export function requestKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
