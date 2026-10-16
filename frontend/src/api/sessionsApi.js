import api from "./axiosConfig";

function unwrap(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data;
  }
  return body;
}

export async function fetchDeviceSessions() {
  const res = await api.get("/auth/sessions");
  return unwrap(res);
}

export async function revokeDeviceSession(sessionId) {
  const res = await api.post(`/auth/sessions/${sessionId}/revoke`);
  return unwrap(res);
}

export async function revokeAllDeviceSessions() {
  const res = await api.post("/auth/sessions/revoke-all");
  return unwrap(res);
}
