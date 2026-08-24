import api from "./axiosConfig";

// Tenant is derived from the authenticated admin on the backend; the optional
// argument is kept for backward compatibility but no longer required.

// ----- Users -----
export const getUsers = () => api.get("/admin/users");
export const getTeamDirectory = () => api.get("/team-directory");
export const getUser = (id) => api.get(`/admin/users/${id}`);
export const createUser = (payload) => api.post("/admin/users", payload);
export const updateUser = (id, payload) => api.put(`/admin/users/${id}`, payload);
export const deleteUser = (id) => api.delete(`/admin/users/${id}`);
export const adminResetUserPassword = (id) =>
  api.post(`/api/users/${id}/reset-password`);

// ----- Roles -----
export const getRoles = () => api.get("/admin/roles");
export const getRole = (id) => api.get(`/admin/roles/${id}`);
export const createRole = (payload) => api.post("/admin/roles", payload);
export const updateRole = (id, payload) => api.put(`/admin/roles/${id}`, payload);
export const deleteRole = (id) => api.delete(`/admin/roles/${id}`);

// ----- Permission catalogue -----
export const getModules = () => api.get("/admin/permissions/modules");

// ----- Activity / access logs -----
export const getAccessLogs = () => api.get("/admin/access-logs");

export const getPendingApprovals = () => api.get("/admin/approvals");
