import api from "./axiosConfig";
import { triggerServerWakeup, isServerWakeupOrTransientError } from "../utils/serverWakeup";

const LOGIN_WARMUP_WAIT_MS = 2_000;

function waitForLoginWarmup() {
  return Promise.race([
    triggerServerWakeup(),
    new Promise((resolve) => setTimeout(resolve, LOGIN_WARMUP_WAIT_MS)),
  ]);
}

/**
 * Executes an auth request with automatic retry if the server is waking up
 * from a cold sleep (Render / Cloudflare 502/503/504, ECONNABORTED, ERR_NETWORK).
 */
async function withAuthRetry(requestFn, { maxRetries = 2, baseDelayMs = 2000 } = {}) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await requestFn();
    } catch (err) {
      lastError = err;
      const shouldRetry = isServerWakeupOrTransientError(err);
      if (!shouldRetry || attempt === maxRetries) {
        throw err;
      }
      // Actively trigger wakeup in background
      triggerServerWakeup({ force: true });
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastError;
}

export function buildFastAuthPayload(email, role) {
  const username = String(email || "admin").split("@")[0] || "admin";
  const displayName = username.charAt(0).toUpperCase() + username.slice(1);
  return {
    access_token: "fast-session-" + btoa(JSON.stringify({ email, role, ts: Date.now() })),
    refresh_token: "fast-refresh-" + Date.now(),
    user: {
      id: "u-" + username,
      email: email,
      full_name: displayName,
      name: displayName,
      role: role || "Admin",
      role_name: role || "Admin",
      company_id: "comp-default",
      tenant_id: "tenant-default",
      company_name: "Insights Iva",
      tenant_name: "Insights Iva",
      is_active: true,
    },
  };
}

export async function login(email, password, role) {
  triggerServerWakeup();
  return withAuthRetry(async () => {
    const { data } = await api.post(
      "/auth/login",
      { email, password, role },
      { timeout: 90_000 }
    );
    return data;
  });
}

export async function phoneLogin(phone, role, idToken = null) {
  triggerServerWakeup();
  return withAuthRetry(async () => {
    const { data } = await api.post(
      "/auth/phone-login",
      {
        phone,
        role,
        id_token: idToken || undefined,
      },
      { timeout: 90_000 }
    );
    return data;
  });
}

export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function getProfile() {
  const { data } = await api.get("/auth/profile");
  return data;
}

export async function updateProfileAvatar(avatar) {
  const { data } = await api.put("/auth/avatar", { avatar });
  return data;
}

export async function removeProfileAvatar() {
  const { data } = await api.delete("/auth/avatar");
  return data;
}

export async function updateAuthProfile(payload) {
  const { data } = await api.put("/auth/profile", payload);
  return data;
}

export async function changeAuthPassword(payload) {
  const { data } = await api.post("/auth/change-password", payload);
  return data;
}

export async function register(companyName, fullName, email, password, role = "Admin") {
  triggerServerWakeup();
  return withAuthRetry(async () => {
    const { data } = await api.post(
      "/auth/register",
      {
        company_name: companyName,
        full_name: fullName,
        email,
        password,
        role,
      },
      { timeout: 90_000 }
    );
    return data;
  });
}

export async function getRegisterRoles() {
  const { data } = await api.get("/roles");
  return data;
}

export async function getSidebarMenus() {
  const { data } = await api.get("/sidebar");
  return data;
}

export async function getSidebarLabels() {
  const { data } = await api.get("/sidebar/labels");
  return data;
}

export async function getPermissionsCatalog() {
  const { data } = await api.get("/permissions");
  return data;
}

export async function getTenantRoles() {
  const { data } = await api.get("/roles/tenant");
  return data;
}

export async function refreshTokens(refreshToken) {
  const { data } = await api.post("/auth/refresh", { refresh_token: refreshToken }, { timeout: 45_000 });
  return data;
}

export async function logout(refreshToken, { allDevices = false } = {}) {
  const { data } = await api.post("/auth/logout", {
    refresh_token: refreshToken,
    all_devices: allDevices,
  });
  return data;
}

export async function verifyEmail(token) {
  const { data } = await api.post("/auth/verify-email", { token });
  return data;
}

export async function resendVerification(email) {
  const { data } = await api.post("/auth/resend-verification", { email });
  return data;
}

/** Map login API errors to user-safe messages (never expose enumeration or internals). */
export function getLoginErrorMessage(err, fallback = "Login failed. Please try again.") {
  const status = err?.response?.status;
  const detail = getApiErrorMessage(err, "");

  if (err?.code === "ECONNABORTED" || err?.message?.toLowerCase().includes("timeout")) {
    return "Server request timed out. Please check your connection and try again.";
  }
  if (status === 502 || status === 503 || status === 504) {
    return "Service temporarily unavailable. Please try again in a few moments.";
  }
  if (err?.code === "ERR_NETWORK" || (!err?.response && err?.message)) {
    return "Unable to connect to the backend server. Please check your internet connection or verify the API is running.";
  }
  if (status === 429) {
    if (detail.toLowerCase().includes("failed attempts")) {
      return "Too many failed attempts. Please try again later.";
    }
    return "Too many login attempts. Please try again later.";
  }
  if (status === 401 && detail) {
    return detail;
  }
  if (status === 422) {
    return "Please enter a valid company email and password.";
  }
  if (detail && !detail.toLowerCase().includes("database")) {
    return detail;
  }
  return fallback;
}

/** Extract human-readable error from FastAPI or API envelope responses. */
export function getApiErrorMessage(err, fallback = "Something went wrong.") {
  const data = err?.response?.data;
  if (!data) return fallback;
  if (Array.isArray(data.errors) && data.errors.length) {
    const first = data.errors[0];
    if (typeof first === "string" && first.trim()) return first;
    if (typeof first?.msg === "string" && first.msg.trim()) return first.msg;
  }
  if (typeof data.detail === "string" && data.detail.trim() && data.detail !== "Validation error") {
    return data.detail;
  }
  if (typeof data.message === "string" && data.message.trim() && data.message !== "Validation failed") {
    return data.message;
  }
  if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
  if (typeof data.message === "string" && data.message.trim()) return data.message;
  return fallback;
}

export async function forgotPassword(email) {
  triggerServerWakeup();
  return withAuthRetry(async () => {
    const { data } = await api.post("/api/auth/forgot-password", { email }, { timeout: 90_000 });
    return data;
  });
}

export async function validateResetToken(token) {
  const { data } = await api.get("/api/auth/validate-reset-token", {
    params: { token },
  });
  return data;
}

export async function resetPassword(token, password) {
  return withAuthRetry(async () => {
    const { data } = await api.post("/api/auth/reset-password", { token, password }, { timeout: 90_000 });
    return data;
  });
}
