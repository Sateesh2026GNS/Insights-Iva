import { test, expect } from "@playwright/test";
import { API_BASE, WEB_BASE, provisionTenantAdmin, loginViaWebProxy, apiJson } from "./auth-helpers.js";

test.describe("Auth session advanced", () => {
  test.beforeEach(async ({ request }) => {
    const health = await request.get(`${API_BASE}/health`);
    test.skip(!health.ok(), `API not reachable at ${API_BASE}`);
  });

  test("refresh rotates session and logout ends access", async ({ request }) => {
    const account = await provisionTenantAdmin(request, "refresh");
    const login = await loginViaWebProxy(request, account);
    const loginBody = await login.json();
    const refreshToken = loginBody.refresh_token;
    test.skip(!refreshToken, "Dual/cookie mode must expose refresh_token for this API-level rotation check");

    const rotated = await request.post(`${WEB_BASE}/auth/refresh`, {
      data: { refresh_token: refreshToken },
    });
    expect(rotated.ok()).toBeTruthy();
    const rotatedBody = await rotated.json();
    expect(rotatedBody.refresh_token).toBeTruthy();
    expect(rotatedBody.refresh_token).not.toBe(refreshToken);

    const logout = await request.post(`${WEB_BASE}/auth/logout`, {
      data: { refresh_token: rotatedBody.refresh_token },
    });
    expect(logout.ok()).toBeTruthy();

    const me = await request.get(`${WEB_BASE}/auth/me`);
    expect(me.status()).toBe(401);
  });

  test("password change revokes existing access token", async ({ request }) => {
    const account = await provisionTenantAdmin(request, "pwd");
    const login = await loginViaWebProxy(request, account);
    const body = await login.json();
    const access = body.access_token;
    test.skip(!access, "Bearer token required for password-change revocation API test");

    const changed = await request.post(`${WEB_BASE}/auth/change-password`, {
      headers: { Authorization: `Bearer ${access}` },
      data: {
        current_password: account.password,
        new_password: "NewPassw0rd!456",
        confirm_password: "NewPassw0rd!456",
      },
    });
    expect(changed.ok()).toBeTruthy();

    const me = await request.get(`${WEB_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    expect(me.status()).toBe(401);
  });

  test("tenant isolation on sessions list", async ({ request }) => {
    const a = await provisionTenantAdmin(request, "tenant-a");
    const b = await provisionTenantAdmin(request, "tenant-b");

    const loginB = await apiJson(request, "/auth/login", {
      email: b.email,
      password: b.password,
      role: "Admin",
    });
    expect(loginB.ok).toBeTruthy();
    const tokenB = loginB.data.access_token;
    const sessionsB = await apiJson(request, "/auth/sessions", null, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(sessionsB.ok).toBeTruthy();
    const sidB = sessionsB.data.current?.id;
    expect(sidB).toBeTruthy();

    const loginA = await apiJson(request, "/auth/login", {
      email: a.email,
      password: a.password,
      role: "Admin",
    });
    const tokenA = loginA.data.access_token;
    const sessionsA = await apiJson(request, "/auth/sessions", null, {
      method: "GET",
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    expect(sessionsA.ok).toBeTruthy();
    const visible = [];
    if (sessionsA.data.current?.id) visible.push(sessionsA.data.current.id);
    for (const row of sessionsA.data.others || []) visible.push(row.id);
    expect(visible).not.toContain(sidB);
  });
});
