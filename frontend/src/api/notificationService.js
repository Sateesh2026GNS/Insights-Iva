import api from "./axiosConfig";

function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return { ...res, data: body.data, message: body.message };
  }
  return res;
}

export async function fetchNotifications(page = 1, pageSize = 20) {
  return unwrap(
    await api.get("/api/notifications", { params: { page, page_size: pageSize } })
  );
}

export async function fetchUnreadCount() {
  return unwrap(await api.get("/api/notifications/unread-count"));
}

export async function markNotificationRead(notificationId) {
  return unwrap(await api.put(`/api/notifications/${notificationId}/read`));
}

export async function markAllNotificationsRead() {
  return unwrap(await api.put("/api/notifications/read-all"));
}

export async function deleteNotification(notificationId) {
  return unwrap(await api.delete(`/api/notifications/${notificationId}`));
}

export async function clearAllNotifications() {
  return unwrap(await api.delete("/api/notifications/clear"));
}

export async function createNotification(payload) {
  return unwrap(await api.post("/api/notifications", payload));
}

export async function shareDocumentNotification(payload) {
  return unwrap(await api.post("/api/notifications/share", payload));
}

