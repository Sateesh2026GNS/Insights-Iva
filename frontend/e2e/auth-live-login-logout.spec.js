import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test, expect } from "@playwright/test";
import { openCompanyLogin } from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const WEB_BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const PROTECTED_PATH = "/admin/users";

async function loadE2eEnv() {
  const envPath = path.join(__dirname, ".env.e2e");
  const text = await readFile(envPath, "utf8");
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

test.describe("Live login / protected page / logout", () => {
  test("admin can sign in, open a protected page, sign out, and cannot go back", async ({ page, request }) => {
    await loadE2eEnv();
    const email = process.env.E2E_ADMIN_EMAIL;
    const password = process.env.E2E_ADMIN_PASSWORD;
    test.skip(!email || !password, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD missing from frontend/e2e/.env.e2e");

    const timings = {};
    const healthStarted = Date.now();
    const health = await request.get(`${API_BASE}/health`);
    timings.health_ms = Date.now() - healthStarted;
    expect(health.ok(), `API health ${health.status()} in ${timings.health_ms}ms`).toBeTruthy();

    const loginPageStarted = Date.now();
    await openCompanyLogin(page);
    timings.login_page_ms = Date.now() - loginPageStarted;

    await page.getByLabel("Role").selectOption("Admin");
    await page.getByPlaceholder("Company Email").fill(email);
    await page.getByPlaceholder("Password").fill(password);

    const submitStarted = Date.now();
    const loginResponsePromise = page.waitForResponse(
      (res) => res.url().includes("/auth/login") && res.request().method() === "POST",
      { timeout: 30_000 }
    );
    await page.getByRole("button", { name: /sign in/i }).click();
    const loginResponse = await loginResponsePromise;
    timings.login_api_ms = Date.now() - submitStarted;
    const loginStatus = loginResponse.status();
    let loginBody = "";
    try {
      loginBody = (await loginResponse.text()).slice(0, 500);
    } catch {
      loginBody = "";
    }
    expect(
      loginStatus,
      `POST /auth/login returned ${loginStatus}: ${loginBody}`
    ).toBe(200);

    await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 20_000 });
    timings.login_redirect_ms = Date.now() - submitStarted;

    const protectedStarted = Date.now();
    await page.goto(`${WEB_BASE}${PROTECTED_PATH}`);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByLabel(/Account menu/i)).toBeVisible({ timeout: 20_000 });
    timings.protected_page_ms = Date.now() - protectedStarted;

    await page.getByLabel(/Account menu/i).click();
    await page.getByRole("menuitem", { name: /sign out/i }).click();

    const logoutStarted = Date.now();
    await page.getByRole("button", { name: /^sign out$/i }).click();
    await page.waitForURL(/\/login/, { timeout: 20_000 });
    timings.logout_ms = Date.now() - logoutStarted;
    await expect(page).toHaveURL(/\/login/);

    await page.goBack();
    await page.waitForLoadState("domcontentloaded");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('select[aria-label="Role"]')).toBeVisible();
    await expect(page.getByLabel(/Account menu/i)).toHaveCount(0);

    console.log(`[live-login] ${JSON.stringify(timings)}`);
  });
});
