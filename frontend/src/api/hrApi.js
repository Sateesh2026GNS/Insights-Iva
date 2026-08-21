import api from "./axiosConfig";

export const getEmployees = () => api.get("/hr/employees");
export const getEmployeeSummary = () => api.get("/hr/employees/summary");
export const getEmployeesEnriched = () => api.get("/hr/employees/enriched");
export const createEmployee = (payload) => api.post("/hr/employees", payload);

export const getHrAssets = () => api.get("/hr/assets");
export const createHrAsset = (payload) => api.post("/hr/assets", payload);
export const updateHrAsset = (assetId, payload) => api.put(`/hr/assets/${assetId}`, payload);
export const deleteHrAsset = (assetId) => api.delete(`/hr/assets/${assetId}`);

export const getSafetyIncidents = () => api.get("/hr/incidents");
export const createSafetyIncident = (payload) => api.post("/hr/incidents", payload);
export const updateSafetyIncident = (incidentId, payload) =>
  api.put(`/hr/incidents/${incidentId}`, payload);
export const deleteSafetyIncident = (incidentId) => api.delete(`/hr/incidents/${incidentId}`);

export const getDepartments = () => api.get("/hr/departments");
export const getDepartmentSummary = () => api.get("/hr/departments/summary");
export const getDepartmentDetail = (departmentId) => api.get(`/hr/departments/${departmentId}`);
export const createDepartment = (payload) => api.post("/hr/departments", payload);
export const updateDepartment = (departmentId, payload) => api.put(`/hr/departments/${departmentId}`, payload);
export const deactivateDepartment = (departmentId) => api.patch(`/hr/departments/${departmentId}/deactivate`);
