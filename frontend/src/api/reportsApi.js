import api from "./axiosConfig";

const BASE = "/api/reports";

export function listReports(config = {}) {
  return api.get(BASE, config);
}

export function getReportsCatalog(params = {}, config = {}) {
  return api.get(`${BASE}/catalog`, { params, ...config });
}

export function getReportMeta(slug, config = {}) {
  return api.get(`${BASE}/${encodeURIComponent(slug)}/meta`, config);
}

export function runSystemReport(slug, filters = {}, config = {}) {
  return api.post(`${BASE}/${encodeURIComponent(slug)}/run`, { filters }, config);
}

export function favoriteReport(slug) {
  return api.post(`${BASE}/${encodeURIComponent(slug)}/favorite`);
}

export function unfavoriteReport(slug) {
  return api.delete(`${BASE}/${encodeURIComponent(slug)}/favorite`);
}

export function visitReport(slug) {
  return api.post(`${BASE}/${encodeURIComponent(slug)}/visit`);
}

export function runReport(reportKey, params, config = {}) {
  return api.get(`${BASE}/${reportKey}`, { params, ...config });
}

/** KPI header row — report_key is accepted by API but summary is global/filter-based. */
export function getReportsSummary(params, config = {}) {
  return api.get(`${BASE}/current_stock/summary`, { params, ...config });
}

export function exportReport(reportKey, payload) {
  return api.post(`${BASE}/${reportKey}/export`, payload, { timeout: 120_000 });
}

export function listSavedViews(reportKey) {
  return api.get(`${BASE}/saved-views`, { params: reportKey ? { report_key: reportKey } : undefined });
}

export function createSavedView(body) {
  return api.post(`${BASE}/saved-views`, body);
}

export function updateSavedView(id, body) {
  return api.patch(`${BASE}/saved-views/${id}`, body);
}

export function deleteSavedView(id) {
  return api.delete(`${BASE}/saved-views/${id}`);
}

export function listReportSchedules() {
  return api.get(`${BASE}/schedules`);
}

export function createReportSchedule(body) {
  return api.post(`${BASE}/schedules`, body);
}

export function updateReportSchedule(id, body) {
  return api.patch(`${BASE}/schedules/${id}`, body);
}

export function putReportSchedule(id, body) {
  return api.put(`${BASE}/schedules/${id}`, body);
}

export function deleteReportSchedule(id) {
  return api.delete(`${BASE}/schedules/${id}`);
}

export function getReportSchedule(id) {
  return api.get(`${BASE}/schedules/${id}`);
}

export function runReportSchedule(id) {
  return api.post(`${BASE}/schedules/${id}/run`);
}

export function listScheduleExecutions(id) {
  return api.get(`${BASE}/schedules/${id}/executions`);
}

export function listReportDatasets() {
  return api.get(`${BASE}/datasets`);
}

export function listCustomReports(section = "mine") {
  return api.get(`${BASE}/custom`, { params: { section } });
}

export function getCustomReport(id) {
  return api.get(`${BASE}/custom/${id}`);
}

export function createCustomReport(body) {
  return api.post(`${BASE}/custom`, body);
}

export function updateCustomReport(id, body) {
  return api.put(`${BASE}/custom/${id}`, body);
}

export function deleteCustomReport(id) {
  return api.delete(`${BASE}/custom/${id}`);
}

export function duplicateCustomReport(id) {
  return api.post(`${BASE}/custom/${id}/duplicate`);
}

export function previewCustomReport(body) {
  return api.post(`${BASE}/custom/preview`, body);
}

export function runCustomReport(id, body = {}) {
  return api.post(`${BASE}/custom/${id}/run`, body);
}

export function listCustomReportShares(id) {
  return api.get(`${BASE}/custom/${id}/shares`);
}

export function createCustomReportShare(id, body) {
  return api.post(`${BASE}/custom/${id}/shares`, body);
}

export function deleteCustomReportShare(id, shareId) {
  return api.delete(`${BASE}/custom/${id}/shares/${shareId}`);
}
