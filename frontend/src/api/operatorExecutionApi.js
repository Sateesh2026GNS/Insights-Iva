import api from "./axiosConfig";

const BASE = "/api";

export function getMyWorkOrders() {
  return api.get(`${BASE}/work-orders/my`);
}

export function getMyWorkOrder(id) {
  return api.get(`${BASE}/work-orders/my/${id}`);
}

export function getMyProductionSchedule() {
  return api.get(`${BASE}/production-schedule/my`);
}

export function getMyMachines() {
  return api.get(`${BASE}/machines/my`);
}

export function submitProductionEntry(body) {
  return api.post(`${BASE}/production-entries`, body);
}

export function getMyProductionEntries(params) {
  return api.get(`${BASE}/production-entries/my`, { params });
}

export function submitSafetyIncident(body) {
  return api.post(`${BASE}/safety-incidents`, body);
}

export function getMySafetyIncidents() {
  return api.get(`${BASE}/safety-incidents/my`);
}
