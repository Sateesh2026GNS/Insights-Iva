import api from "./axiosConfig";

const PLATFORM_TOKEN_KEY = "gns-platform-token";
const PLATFORM_ADMIN_KEY = "gns-platform-admin";

export function getPlatformToken() {
  return localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformSession({ access_token, admin }) {
  localStorage.setItem(PLATFORM_TOKEN_KEY, access_token);
  localStorage.setItem(PLATFORM_ADMIN_KEY, JSON.stringify(admin));
}

export function clearPlatformSession() {
  localStorage.removeItem(PLATFORM_TOKEN_KEY);
  localStorage.removeItem(PLATFORM_ADMIN_KEY);
}

export function getPlatformAdmin() {
  try {
    const raw = localStorage.getItem(PLATFORM_ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function platformHeaders() {
  const token = getPlatformToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function superAdminLogin(email, password) {
  const { data } = await api.post(
    "/platform/auth/login",
    { email, password },
    { skipGlobalError: true }
  );
  return data;
}

export async function superAdminVerifyOtp(challengeToken, otp, firebaseToken = null) {
  const { data } = await api.post(
    "/platform/auth/verify-otp",
    {
      challenge_token: challengeToken,
      otp,
      firebase_token: firebaseToken || undefined,
    },
    { skipGlobalError: true }
  );
  return data;
}

export async function superAdminResendOtp(challengeToken) {
  const { data } = await api.post(
    "/platform/auth/resend-otp",
    {
      challenge_token: challengeToken,
    },
    { skipGlobalError: true }
  );
  return data;
}

export async function getSuperAdminProfile() {
  const { data } = await api.get("/platform/auth/me", { headers: platformHeaders() });
  return data;
}

export async function listCompanies() {
  const { data } = await api.get("/platform/companies", { headers: platformHeaders() });
  return data;
}

export async function createCompany(payload) {
  const { data } = await api.post("/platform/companies", payload, { headers: platformHeaders() });
  return data;
}

export async function getCompany(tenantId) {
  const { data } = await api.get(`/platform/companies/${tenantId}`, { headers: platformHeaders() });
  return data;
}

export async function updateCompany(tenantId, payload) {
  const { data } = await api.put(`/platform/companies/${tenantId}`, payload, {
    headers: platformHeaders(),
  });
  return data;
}

export async function activateCompany(tenantId) {
  const { data } = await api.post(`/platform/companies/${tenantId}/activate`, null, {
    headers: platformHeaders(),
  });
  return data;
}

export async function suspendCompany(tenantId) {
  const { data } = await api.post(`/platform/companies/${tenantId}/suspend`, null, {
    headers: platformHeaders(),
  });
  return data;
}

export async function deleteCompany(tenantId) {
  await api.delete(`/platform/companies/${tenantId}`, { headers: platformHeaders() });
}

export async function resetCompanyPassword(tenantId, newPassword) {
  const { data } = await api.post(
    `/platform/companies/${tenantId}/reset-password`,
    { new_password: newPassword },
    { headers: platformHeaders() }
  );
  return data;
}

export async function listCompanyUsers(tenantId) {
  const { data } = await api.get(`/platform/companies/${tenantId}/users`, {
    headers: platformHeaders(),
  });
  return data;
}

export async function getCompanySubscription(tenantId) {
  const { data } = await api.get(`/platform/companies/${tenantId}/subscription`, {
    headers: platformHeaders(),
  });
  return data;
}

export async function updateCompanyLicense(tenantId, payload) {
  const { data } = await api.put(`/platform/companies/${tenantId}/license`, payload, {
    headers: platformHeaders(),
  });
  return data;
}
