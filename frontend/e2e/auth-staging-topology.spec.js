import { test, expect } from "@playwright/test";
import { requireStagingEnv, stagingEnvReport } from "./auth-staging-env.js";

test.describe.configure({ mode: "serial" });

test.describe("Auth staging topology", () => {
  test("preflight: staging environment variables", () => {
    const report = stagingEnvReport();
    if (!process.env.E2E_STAGING_ACK_NON_PRODUCTION) {
      test.skip(true, report.skipReason);
      return;
    }
    expect(report.missing, report.skipReason || "staging env incomplete").toEqual([]);
  });

  test("health and cookie security flags on HTTPS staging API", async ({ request }) => {
    const env = requireStagingEnv(test);
    const health = await request.get(`${env.api}/health`);
    expect(health.ok()).toBeTruthy();

    const csrf = await request.get(`${env.api}/auth/csrf`);
    expect(csrf.ok()).toBeTruthy();
    const setCookie = csrf.headers()["set-cookie"] || "";
    const blob = Array.isArray(setCookie) ? setCookie.join(";") : String(setCookie);
    if (blob) {
      expect(blob.toLowerCase()).toContain("secure");
    }
  });

  test("CORS preflight allows configured staging frontend origin", async ({ request }) => {
    const env = requireStagingEnv(test);
    const origin = env.web.replace(/\/$/, "");
    const res = await request.fetch(`${env.api}/auth/csrf`, {
      method: "OPTIONS",
      headers: {
        Origin: origin,
        "Access-Control-Request-Method": "GET",
      },
    });
    expect([200, 204, 405]).toContain(res.status());
  });

  test("cookie login, CSRF, refresh rotation, logout, and revoked session", async ({ request }) => {
    const env = requireStagingEnv(test);
    const role = process.env.E2E_STAGING_ADMIN_ROLE || "Admin";

    await request.get(`${env.api}/auth/csrf`);
    const login = await request.post(`${env.api}/auth/login`, {
      data: { email: env.email, password: env.password, role },
    });
    expect(login.ok(), await login.text()).toBeTruthy();
    const loginBody = await login.json();
    const setCookie = login.headers()["set-cookie"] || "";
    const cookieBlob = Array.isArray(setCookie) ? setCookie.join("\n") : String(setCookie);
    expect(cookieBlob).toMatch(/iva_at=/i);
    expect(cookieBlob).toMatch(/iva_rt=/i);
    expect(cookieBlob.toLowerCase()).toContain("httponly");
    expect(cookieBlob.toLowerCase()).toContain("secure");

    const csrfRes = await request.get(`${env.api}/auth/csrf`);
    const csrfToken = (await csrfRes.json()).csrf_token;
    expect(csrfToken?.length).toBeGreaterThan(10);

    const badPost = await request.post(`${env.api}/api/files/upload-url`, {
      data: { filename: "x.png", file_size: 10, mime_type: "image/png" },
    });
    expect([401, 403]).toContain(badPost.status());

    let refreshForLogout = loginBody.refresh_token;
    if (!refreshForLogout) {
      const state = await request.storageState();
      const rt = (state.cookies || []).find((c) => c.name === "iva_rt");
      expect(rt, "cookie-mode login must set iva_rt").toBeTruthy();
      const rotated = await request.post(`${env.api}/auth/refresh`, {
        headers: { "X-CSRF-Token": csrfToken },
      });
      expect(rotated.ok()).toBeTruthy();
      const rotatedBody = await rotated.json();
      refreshForLogout = rotatedBody.refresh_token;
    } else {
      const rotated = await request.post(`${env.api}/auth/refresh`, {
        data: { refresh_token: refreshForLogout },
        headers: { "X-CSRF-Token": csrfToken },
      });
      expect(rotated.ok()).toBeTruthy();
      const newRefresh = (await rotated.json()).refresh_token;
      expect(newRefresh).toBeTruthy();
      expect(newRefresh).not.toBe(refreshForLogout);
      refreshForLogout = newRefresh;
    }

    const logout = await request.post(`${env.api}/auth/logout`, {
      data: refreshForLogout ? { refresh_token: refreshForLogout } : {},
      headers: { "X-CSRF-Token": csrfToken },
    });
    expect(logout.ok()).toBeTruthy();

    expect((await request.get(`${env.api}/auth/me`)).status()).toBe(401);

    if (refreshForLogout) {
      const reused = await request.post(`${env.api}/auth/refresh`, {
        data: { refresh_token: refreshForLogout },
        headers: { "X-CSRF-Token": csrfToken },
      });
      expect(reused.status()).toBe(401);
    }
  });

  test("tenant isolation on sessions list", async ({ request }) => {
    const env = requireStagingEnv(test);
    const role = process.env.E2E_STAGING_ADMIN_ROLE || "Admin";
    const otherEmail = process.env.E2E_STAGING_OTHER_TENANT_EMAIL;
    test.skip(!otherEmail, "Set E2E_STAGING_OTHER_TENANT_EMAIL for cross-tenant isolation check");

    const loginB = await request.post(`${env.api}/auth/login`, {
      data: {
        email: otherEmail,
        password: process.env.E2E_STAGING_OTHER_TENANT_PASSWORD || env.password,
        role,
      },
    });
    expect(loginB.ok()).toBeTruthy();
    const tokenB = (await loginB.json()).access_token;
    expect(tokenB).toBeTruthy();
    const sessionsB = await request.get(`${env.api}/auth/sessions`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    const sidB = (await sessionsB.json()).current?.id;
    expect(sidB).toBeTruthy();

    const loginA = await request.post(`${env.api}/auth/login`, {
      data: { email: env.email, password: env.password, role },
    });
    const tokenA = (await loginA.json()).access_token;
    const sessionsA = await request.get(`${env.api}/auth/sessions`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const bodyA = await sessionsA.json();
    const visible = [];
    if (bodyA.current?.id) visible.push(bodyA.current.id);
    for (const row of bodyA.others || []) visible.push(row.id);
    expect(visible).not.toContain(sidB);
  });

  test("browser login redirect and session persistence", async ({ page, request }) => {
    const env = requireStagingEnv(test);
    const role = process.env.E2E_STAGING_ADMIN_ROLE || "Admin";

    await page.goto(`${env.web}/login`);
    await page.locator('select[aria-label="Role"]').selectOption(role);
    await page.getByPlaceholder("Company Email").fill(env.email);
    await page.getByPlaceholder("Password").fill(env.password);
    await page.getByRole("button", { name: /^SIGN IN$/i }).click();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 30_000 });

    const exposed = await page.evaluate(() => ({
      token: localStorage.getItem("smrt-token"),
      refresh: localStorage.getItem("smrt-refresh-token"),
    }));
    expect(exposed.token).toBeFalsy();
    expect(exposed.refresh).toBeFalsy();

    await page.reload();
    await expect(page).not.toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
