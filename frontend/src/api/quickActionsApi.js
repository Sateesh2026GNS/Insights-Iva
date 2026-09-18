import api from "./axiosConfig";

const BASE = "/api/erp/dashboard/quick-actions";

/** Unwrap standard { success, message, data } envelope from ERP dashboard APIs. */
export function unwrapQuickActionPayload(res) {
  const body = res?.data;
  if (!body || typeof body !== "object") {
    return { items: [], total: 0, page: 1, page_size: 10, total_pages: 0 };
  }
  if (body.success === false) {
    const err = new Error(body.message || "Request failed");
    err.response = { data: body };
    throw err;
  }
  const payload = body.data !== undefined && body.data !== null ? body.data : body;
  if (!payload || typeof payload !== "object") {
    return { items: [], total: 0, page: 1, page_size: 10, total_pages: 0 };
  }
  return {
    ...payload,
    items: Array.isArray(payload.items) ? payload.items : [],
    total: Number(payload.total) || 0,
    page: Number(payload.page) || 1,
    page_size: Number(payload.page_size) || 10,
    total_pages: Number(payload.total_pages) || 0,
  };
}

const quickGet = (url, params) =>
  api.get(url, { params, skipCache: true }).then(unwrapQuickActionPayload);

export function fetchQuickActionWorkOrders(params) {
  return quickGet(`${BASE}/work-orders`, params);
}

export function fetchQuickActionProduction(params) {
  return quickGet(`${BASE}/production`, params);
}

export function fetchQuickActionMaterialIssues(params) {
  return quickGet(`${BASE}/material-issues`, params);
}

export function fetchQuickActionStockTransfers(params) {
  return quickGet(`${BASE}/stock-transfers`, params);
}

export function fetchQuickActionQuality(params) {
  return quickGet(`${BASE}/quality`, params);
}
