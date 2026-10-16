import { expect } from "@playwright/test";

export const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
export const WEB_BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
export const E2E_PASSWORD = "Passw0rd!123";

export async function apiJson(request, path, body, { method = "POST", headers = {} } = {}) {
  const res = await request.fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...headers,
    },
    data: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok(), status: res.status(), data, text, headers: res.headers() };
}

export async function provisionTenantAdmin(request, label = "auth-e2e") {
  const stamp = `${label}-${Date.now().toString(36)}`;
  const email = `e2e-${stamp}@company-e2e.test`;
  const reg = await apiJson(request, "/auth/register", {
    company_name: `E2E ${stamp}`,
    full_name: "E2E Admin",
    email,
    password: E2E_PASSWORD,
    role: "Admin",
  });
  expect(reg.ok, `${API_BASE}/auth/register → ${reg.status}: ${reg.text.slice(0, 200)}`).toBeTruthy();
  const login = await apiJson(request, "/auth/login", {
    email,
    password: E2E_PASSWORD,
    role: "Admin",
  });
  expect(login.ok, login.text).toBeTruthy();
  return { email, password: E2E_PASSWORD, role: "Admin", login: login.data };
}

export function cookieNamesFromJar(jar) {
  return jar.map((c) => c.name);
}

export async function loginViaWebProxy(request, { email, password, role }) {
  await request.get(`${WEB_BASE}/auth/csrf`);
  const login = await request.post(`${WEB_BASE}/auth/login`, {
    data: { email, password, role },
  });
  expect(login.ok(), await login.text()).toBeTruthy();
  return login;
}

export async function loginViaWebProxyJson(request, account) {
  const res = await loginViaWebProxy(request, account);
  return res.json();
}
