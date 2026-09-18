import api from "./axiosConfig";

export const getApprovalQueue = (params = {}) =>
  api.get("/admin/approvals/queue", { params });

export const getMyApprovalCounts = () => api.get("/admin/approvals/my-counts");

export const approveLeaveRequest = (leaveId, body = {}) =>
  api.post(`/admin/approvals/leave/${leaveId}/approve`, body);

export const rejectLeaveRequest = (leaveId, body = {}) =>
  api.post(`/admin/approvals/leave/${leaveId}/reject`, body);

export const getLeaveApprovalHistory = (leaveId) =>
  api.get(`/admin/approvals/leave/${leaveId}/history`);

export const decideMaterialRequest = (mrId, body) =>
  api.post(`/admin/approvals/material-request/${mrId}/decide`, body);

export const decideVendor = (vendorId, body) =>
  api.post(`/admin/approvals/vendor/${vendorId}/decide`, body);

export const decidePurchaseOrder = (poId, body) =>
  api.post(`/admin/approvals/purchase-order/${poId}/decide`, body);

export const decideProductionOrder = (orderId, body) =>
  api.post(`/admin/approvals/production/${orderId}/decide`, body);

export const decideInventoryAdjustment = (adjustmentId, body) =>
  api.post(`/admin/approvals/inventory/${adjustmentId}/decide`, body);
