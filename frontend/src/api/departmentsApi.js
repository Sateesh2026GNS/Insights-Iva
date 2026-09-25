import api from "./axiosConfig";

export const getDepartments = () => api.get("/masters/departments");
export const getDepartmentSummary = () => api.get("/masters/departments/summary");
export const getDepartmentDetail = (departmentId) => api.get(`/masters/departments/${departmentId}`);
export const createDepartment = (payload) => api.post("/masters/departments", payload);
export const updateDepartment = (departmentId, payload) =>
  api.put(`/masters/departments/${departmentId}`, payload);
export const deactivateDepartment = (departmentId) =>
  api.patch(`/masters/departments/${departmentId}/deactivate`);
export const deleteDepartment = (departmentId) =>
  api.delete(`/masters/departments/${departmentId}`);

