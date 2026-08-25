import api from "./axiosConfig";

export async function login(email, password, role) {
  const { data } = await api.post("/auth/login", { email, password, role });
  return data;
}

export async function phoneLogin(phone, role, idToken = null) {
  const { data } = await api.post("/auth/phone-login", {
    phone,
    role,
    id_token: idToken || undefined,
  });
  return data;
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

export async function register(companyName, fullName, email, password, role = "Admin") {
  const { data } = await api.post("/auth/register", {
    company_name: companyName,
    full_name: fullName,
    email,
    password,
    role,
  });
  return data;
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
  const { data } = await api.post("/auth/refresh", { refresh_token: refreshToken });
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
  const { data } = await api.post("/api/auth/forgot-password", { email });
  return data;
}

export async function validateResetToken(token) {
  const { data } = await api.get("/api/auth/validate-reset-token", {
    params: { token },
  });
  return data;
}

export async function resetPassword(token, password) {
  const { data } = await api.post("/api/auth/reset-password", { token, password });
  return data;
}
