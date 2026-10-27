import api from "./axiosConfig";
import {
  clearAllNotifications,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notificationService";

export const getAlerts = (params = {}) =>
  api.get("/alerts", { params: { ...params } }).then((res) => {
    // Normalize list envelope: { items, total } or legacy array
    const body = res.data;
    if (Array.isArray(body)) return { ...res, data: body };
    if (body?.items) return { ...res, data: body.items, meta: body };
    if (Array.isArray(body?.data)) return { ...res, data: body.data };
    return { ...res, data: [] };
  });

export const markAlertRead = (alertId) => api.put(`/alerts/${alertId}/read`);

export const markAllAlertsRead = () => api.post("/alerts/mark-all-read");

export const getAlert = (alertId) => api.get(`/alerts/${alertId}`);

/** @deprecated Use notificationService.fetchNotifications */
export const getNotifications = () => fetchNotifications();

/** @deprecated Use notificationService.markNotificationRead / markAllNotificationsRead */
export const markNotificationsRead = (notificationIds = null) => {
  if (!notificationIds?.length) return markAllNotificationsRead();
  return markNotificationRead(notificationIds[0]);
};

/** @deprecated Use notificationService.clearAllNotifications */
export const clearNotifications = () => clearAllNotifications();

export const syncLowStockAlerts = () => api.post("/alerts/sync-low-stock");

export const createAlert = (payload) => api.post("/alerts", payload);

export const acknowledgeAlert = (alertId) =>
  api.put(`/alerts/${alertId}/acknowledge`);

export const resolveAlert = (alertId) => api.put(`/alerts/${alertId}/resolve`);

export const deleteAlert = (alertId) => api.delete(`/alerts/${alertId}`);

export async function getAllAlertPages(params = {}) {
  const pageSize = 200;
  const first = await getAlerts({ ...params, page: 1, page_size: pageSize });
  const items = [...(first.data || [])];
  const total = first.meta?.total ?? items.length;
  const pages = Math.min(10, Math.ceil(total / pageSize));
  for (let page = 2; page <= pages; page += 1) {
    const next = await getAlerts({ ...params, page, page_size: pageSize });
    items.push(...(next.data || []));
  }
  return items;
}

export const getOrderDelays = (params = {}) => api.get("/alerts/order-delays", { params });

export const getOrderDelay = (orderId) => api.get(`/alerts/order-delays/${orderId}`);

export const addOrderDelayFollowUp = (orderId, note) =>
  api.post(`/alerts/order-delays/${orderId}/follow-up`, { note });

export const acknowledgeOrderDelay = (orderId) => api.post(`/alerts/order-delays/${orderId}/acknowledge`);

export const resolveOrderDelay = (orderId) => api.post(`/alerts/order-delays/${orderId}/resolve`);

export const notifyOrderDelay = (orderId) => api.post(`/alerts/order-delays/${orderId}/notify`);
