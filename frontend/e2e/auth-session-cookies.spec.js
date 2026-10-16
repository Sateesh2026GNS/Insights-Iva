import { test, expect } from "@playwright/test";
import {
  API_BASE,
  WEB_BASE,
  provisionTenantAdmin,
  loginViaWebProxy,
  E2E_PASSWORD,
} from "./auth-helpers.js";

test.describe("Auth session cookies", () => {
  test.beforeEach(async ({ request }) => {
    const health = await request.get(`${API_BASE}/health`);
    test.skip(!health.ok(), `API not reachable at ${API_BASE}`);
  });

  test("login via Vite proxy sets HttpOnly session cookies and CSRF", async ({ request, page }) => {
    const account = await provisionTenantAdmin(request, "cookies");
    const loginRes = await loginViaWebProxy(request, account);
    const setCookie = loginRes.headers()["set-cookie"] || "";
    const blob = Array.isArray(setCookie) ? setCookie.join("\n") : String(setCookie);
    expect(blob).toMatch(/iva_at=/i);
    expect(blob).toMatch(/iva_rt=/i);
    expect(blob.toLowerCase()).toContain("httponly");

    const state = await request.storageState();
    const names = (state.cookies || []).map((c) => c.name);
    expect(names).toContain("iva_at");
    expect(names).toContain("iva_rt");

    const csrfRes = await request.get(`${WEB_BASE}/auth/csrf`);
    expect(csrfRes.ok()).toBeTruthy();
    const csrfBody = await csrfRes.json();
    expect(csrfBody.csrf_token?.length).toBeGreaterThan(20);

    await page.goto(`${WEB_BASE}/login`);
    const exposed = await page.evaluate(() => ({
      token: localStorage.getItem("smrt-token"),
      refresh: localStorage.getItem("smrt-refresh-token"),
    }));
    expect(exposed.token).toBeFalsy();
    expect(exposed.refresh).toBeFalsy();
  });

  test("CSRF-protected POST without token is rejected when session cookies exist", async ({ request }) => {
    const account = await provisionTenantAdmin(request, "csrf");
    await loginViaWebProxy(request, account);

    const upload = await request.post(`${WEB_BASE}/api/files/upload-url`, {
      data: { filename: "probe.png", file_size: 10, mime_type: "image/png" },
    });
    expect([401, 403]).toContain(upload.status());
  });
});
