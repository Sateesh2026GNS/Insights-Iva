/**
 * Store Manager — Inventory Register & Raw Material Tracker on Production Planning (staging only).
 *
 * Run:
 *   E2E_SKIP_WEB_SERVER=1 ^
 *   E2E_STAGING_ACK_NON_PRODUCTION=1 ^
 *   E2E_STAGING_API_URL=https://... ^
 *   E2E_STAGING_BASE_URL=https://... ^
 *   E2E_STAGING_STORE_MANAGER_EMAIL=... ^
 *   E2E_STAGING_STORE_MANAGER_PASSWORD=... ^
 *   npx playwright test --project=store-manager-staging
 */
import { test, expect } from "@playwright/test";
import {
  loadStagingE2eEnvFile,
  requireStagingStoreManagerEnv,
  stagingStoreManagerEnvReport,
} from "./auth-staging-env.js";
import { loginStagingApi, loginStagingViaUi } from "./auth-staging-helpers.js";

test.describe.configure({ mode: "serial" });

/** Static reference rows stripped at runtime — must not appear as live data. */
const REFERENCE_DEMO_MARKERS = ["FG-101", "Steel Bracket", "Plastic Housing"];

test.beforeAll(async () => {
  await loadStagingE2eEnvFile();
});

test.describe("Store Manager inventory toolkits (staging)", () => {
  test("preflight: staging HTTPS URLs and Store Manager credentials", () => {
    const report = stagingStoreManagerEnvReport();
    if (!process.env.E2E_STAGING_ACK_NON_PRODUCTION) {
      test.skip(true, report.skipReason);
      return;
    }
    expect(report.missing, report.skipReason || "staging env incomplete").toEqual([]);
    expect(report.api).toMatch(/^https:\/\//);
    expect(report.web).toMatch(/^https:\/\//);
    expect(report.storeManager.email).toBeTruthy();
    expect(report.storeManager.password).toBeTruthy();
  });

  test("API: inventory and raw-material reads allowed; production planning denied", async ({ request }) => {
    const env = requireStagingStoreManagerEnv(test);
    const api = env.api.replace(/\/$/, "");
    const sm = env.storeManager;

    await loginStagingApi(request, env, sm);

    const dashboard = await request.get(`${api}/inventory/dashboard`);
    expect(dashboard.status(), await dashboard.text()).toBe(200);

    const rmSummary = await request.get(`${api}/inventory/raw-materials/summary`);
    expect(rmSummary.status(), await rmSummary.text()).toBe(200);

    const rmList = await request.get(`${api}/inventory/raw-materials`);
    expect(rmList.status(), await rmList.text()).toBe(200);

    const planning = await request.get(`${api}/api/production/planning`);
    expect(planning.status(), await planning.text()).toBe(403);

    const toolkitIssues = await request.get(`${api}/api/production/toolkit/issues?page=1`);
    expect([401, 403]).toContain(toolkitIssues.status());
  });

  test("API: production planning write probe denied (no data created)", async ({ request }) => {
    const env = requireStagingStoreManagerEnv(test);
    const api = env.api.replace(/\/$/, "");
    await loginStagingApi(request, env, env.storeManager);

    const create = await request.post(`${api}/api/production/planning`, {
      data: { product_id: 1, planned_quantity: 1 },
    });
    expect([400, 403, 404, 422]).toContain(create.status());
    expect(create.status()).not.toBe(201);
  });

  test("UI: sidebar opens Inventory Register with inventory API, not production planning", async ({ page }) => {
    const env = requireStagingStoreManagerEnv(test);
    const planningHits = [];

    page.on("request", (req) => {
      if (/\/api\/production\/planning/.test(req.url())) planningHits.push(req.url());
    });

    await loginStagingViaUi(page, env, env.storeManager);

    const inventoryNav = page.getByRole("button", { name: /^Inventory$/i });
    if (await inventoryNav.isVisible()) {
      await inventoryNav.click();
    }

    const invResponse = page.waitForResponse(
      (res) => res.url().includes("/inventory/dashboard") && res.status() === 200,
      { timeout: 45_000 }
    );

    await page.getByRole("link", { name: "Inventory Register" }).click();
    await expect(page).toHaveURL(/toolkit=inventory_register/, { timeout: 45_000 });

    await invResponse;

    const tablist = page.getByRole("tablist", { name: "Manufacturing toolkits" });
    await expect(tablist).toBeVisible({ timeout: 30_000 });
    await expect(tablist.getByRole("tab", { name: "Inventory Register" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(tablist.getByRole("tab", { name: "Issue Log" })).toHaveCount(0);
    await expect(tablist.getByRole("tab", { name: "Daily & Weekly Planner" })).toHaveCount(0);

    await expect(page.locator(".production-planning-table")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /New Production Order/i })).toHaveCount(0);

    for (const marker of REFERENCE_DEMO_MARKERS) {
      await expect(page.getByText(marker, { exact: false })).toHaveCount(0);
    }

    expect(planningHits, "Store Manager must not call production planning API").toEqual([]);
  });

  test("UI: sidebar opens Raw Material Tracker with raw-material APIs", async ({ page }) => {
    const env = requireStagingStoreManagerEnv(test);
    const planningHits = [];

    page.on("request", (req) => {
      if (/\/api\/production\/planning/.test(req.url())) planningHits.push(req.url());
    });

    await loginStagingViaUi(page, env, env.storeManager);

    const inventoryNav = page.getByRole("button", { name: /^Inventory$/i });
    if (await inventoryNav.isVisible()) {
      await inventoryNav.click();
    }

    const rmResponse = page.waitForResponse(
      (res) =>
        (res.url().includes("/inventory/raw-materials") || res.url().includes("/raw-materials/summary")) &&
        res.status() === 200,
      { timeout: 45_000 }
    );

    await page.getByRole("link", { name: "Raw Material Tracker" }).click();
    await expect(page).toHaveURL(/toolkit=raw_material_tracker/, { timeout: 45_000 });
    await rmResponse;

    const tablist = page.getByRole("tablist", { name: "Manufacturing toolkits" });
    await expect(tablist.getByRole("tab", { name: "Raw Material Tracker" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    expect(planningHits).toEqual([]);
    await expect(page.locator(".production-planning-table")).toHaveCount(0);
  });

  test("UI: forbidden toolkit URL normalizes without issue-log API or UI", async ({ page }) => {
    const env = requireStagingStoreManagerEnv(test);
    const web = env.web.replace(/\/$/, "");
    const successfulIssueReads = [];

    page.on("response", (res) => {
      if (/\/api\/production\/toolkit\/issues/.test(res.url()) && res.status() === 200) {
        successfulIssueReads.push(res.url());
      }
    });

    await loginStagingViaUi(page, env, env.storeManager);
    await page.goto(`${web}/production/planning?toolkit=issue_log`);

    const tablist = page.getByRole("tablist", { name: "Manufacturing toolkits" });
    await expect(tablist).toBeVisible({ timeout: 45_000 });
    await expect(tablist.getByRole("tab", { name: "Issue Log" })).toHaveCount(0);
    await expect(tablist.getByRole("tab", { name: "Inventory Register" })).toHaveAttribute(
      "aria-selected",
      "true"
    );

    await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
    expect(successfulIssueReads).toEqual([]);
  });
});
