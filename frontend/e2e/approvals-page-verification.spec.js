import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB_BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const REPORT_DIR = path.join(__dirname, "..", "..", "docs", "qa", "approvals-browser-verification");
const SHOT_DIR = path.join(REPORT_DIR, "screenshots");

const VIEWPORTS = [
  { name: "320", width: 320, height: 800 },
  { name: "360", width: 360, height: 800 },
  { name: "390", width: 390, height: 844 },
  { name: "430", width: 430, height: 932 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1366", width: 1366, height: 768 },
  { name: "1440", width: 1440, height: 900 },
  { name: "1920", width: 1920, height: 1080 },
];

function loadE2eEnv() {
  try {
    const text = readFileSync(path.join(__dirname, ".env.e2e"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq <= 0) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadE2eEnv();

/** @type {import('@playwright/test').TestInfo} */
const report = {
  runAt: new Date().toISOString(),
  baseURL: WEB_BASE,
  viewports: [],
  workflows: [],
  consoleErrors: [],
  networkFailures: [],
  issues: [],
  notes: [],
};

async function loginAsAdmin(page) {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("Set E2E_ADMIN_EMAIL and E2E_ADMIN_PASSWORD in frontend/e2e/.env.e2e");
  }
  await page.request.get(`${WEB_BASE}/auth/csrf`);
  const loginRes = await page.request.post(`${WEB_BASE}/auth/login`, {
    data: { email, password, role: "Admin" },
  });
  if (!loginRes.ok()) {
    throw new Error(`Admin login failed: HTTP ${loginRes.status()}`);
  }
  const loginBody = await loginRes.json();
  const user = loginBody.user;
  await page.goto(`${WEB_BASE}/login`);
  await page.evaluate((u) => {
    localStorage.setItem("smrt-session-active", "1");
    localStorage.setItem("smrt-user", JSON.stringify(u));
    localStorage.setItem("smrt-login-time", String(Date.now()));
    localStorage.setItem("smrt-primary-heartbeat", String(Date.now()));
  }, user);
  const accessToken = loginBody.access_token || loginBody.token;
  const refreshToken = loginBody.refresh_token;
  if (accessToken || refreshToken) {
    await page.evaluate(
      ({ access, refresh }) => {
        if (access) localStorage.setItem("smrt-token", access);
        if (refresh) localStorage.setItem("smrt-refresh-token", refresh);
      },
      { access: accessToken, refresh: refreshToken }
    );
  }
}

function trackDiagnostics(page) {
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (/favicon|404.*\.map/i.test(text)) return;
      report.consoleErrors.push(text.slice(0, 500));
    }
  });
  page.on("response", (res) => {
    const url = res.url();
    if (res.status() >= 400 && /\/admin\/approvals|\/auth\//.test(url)) {
      report.networkFailures.push(`${res.status()} ${url}`);
    }
  });
}

async function waitForApprovalsReady(page) {
  await expect(page.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator(".approvals-page")).toBeVisible();
  await page.waitForResponse(
    (res) => res.url().includes("/admin/approvals/queue") && res.status() === 200,
    { timeout: 30_000 }
  ).catch(() => {
    report.notes.push("Queue API response not observed within timeout on one navigation.");
  });
  await expect(page.locator(".approvals-kpis")).toBeVisible();
}

async function hasHorizontalOverflow(page) {
  return page.evaluate(() => {
    const root = document.documentElement;
    return root.scrollWidth > root.clientWidth + 1;
  });
}

async function fabOverlapsContent(page) {
  return page.evaluate(() => {
    const stack = document.querySelector(".app-shell-fab-stack");
    const target =
      document.querySelector(".approvals-pagination") ||
      document.querySelector(".approvals-empty") ||
      document.querySelector(".approvals-actions") ||
      document.querySelector(".approvals-filters__actions");
    if (!stack || !target) return { checked: false, overlaps: false };
    const a = stack.getBoundingClientRect();
    const b = target.getBoundingClientRect();
    const overlaps =
      a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    return { checked: true, overlaps };
  });
}

test.describe("Approvals page — browser verification", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async () => {
    await mkdir(SHOT_DIR, { recursive: true });
  });

  test.afterAll(async () => {
    const md = [
      `# Approvals page — browser verification`,
      ``,
      `Run at: ${report.runAt}`,
      `Base URL: ${report.baseURL}`,
      ``,
      `## Viewports`,
      ...report.viewports.map(
        (v) =>
          `- **${v.name}px** (${v.width}×${v.height}): overflow=${v.overflow ? "YES" : "no"}, hero=${v.hero ? "YES" : "no"}, screenshot=\`screenshots/${v.name}.png\``
      ),
      ``,
      `## Workflows`,
      ...report.workflows.map((w) => `- ${w}`),
      ``,
      `## Console errors (filtered)`,
      ...(report.consoleErrors.length
        ? report.consoleErrors.slice(0, 20).map((e) => `- ${e}`)
        : ["- None captured on approval routes"]),
      ``,
      `## Network failures (approvals/auth)`,
      ...(report.networkFailures.length
        ? report.networkFailures.map((e) => `- ${e}`)
        : ["- None"]),
      ``,
      ...(report.issues.length ? [`## Issues`, ...report.issues.map((i) => `- ${i}`)] : []),
      ...(report.notes.length ? [`## Notes`, ...report.notes.map((n) => `- ${n}`)] : []),
    ].join("\n");
    await writeFile(path.join(REPORT_DIR, "REPORT.md"), md, "utf8");
    await writeFile(path.join(REPORT_DIR, "report.json"), JSON.stringify(report, null, 2), "utf8");
  });

  test("responsive layout snapshots", async ({ page }) => {
    trackDiagnostics(page);
    await loginAsAdmin(page);
    await page.goto(`${WEB_BASE}/admin/approvals`);
    await waitForApprovalsReady(page);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(300);
      const overflow = await hasHorizontalOverflow(page);
      const hero = await page.locator(".erp-hero-header").count();
      await page.screenshot({
        path: path.join(SHOT_DIR, `${vp.name}.png`),
        fullPage: true,
      });
      report.viewports.push({
        name: vp.name,
        width: vp.width,
        height: vp.height,
        overflow,
        hero: hero > 0,
      });
      if (overflow) {
        report.issues.push(`Horizontal overflow at ${vp.name}px`);
      }
      if (hero > 0) {
        report.issues.push(`Blue erp hero still present at ${vp.name}px`);
      }
      expect(hero, `erp hero at ${vp.name}px`).toBe(0);
      expect(overflow, `horizontal overflow at ${vp.name}px`).toBe(false);
    }
    report.workflows.push("Captured full-page screenshots at all 9 viewports; no erp hero; no horizontal document overflow.");
  });

  test("department tabs and KPI filters", async ({ page }) => {
    trackDiagnostics(page);
    await loginAsAdmin(page);
    await page.goto(`${WEB_BASE}/admin/approvals`);
    await waitForApprovalsReady(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const tabs = ["All", "Leaves", "Procurement", "Production", "Inventory"];
    for (const label of tabs) {
      const queuePromise = page.waitForResponse(
        (res) => res.url().includes("/admin/approvals/queue") && res.status() === 200
      );
      await page.getByRole("tab", { name: new RegExp(`^${label}`) }).click();
      const res = await queuePromise;
      const url = new URL(res.url());
      report.workflows.push(`Tab ${label}: queue ${url.search || "(no query)"}`);
    }

    const kpiMap = [
      ["Total Requests", "all"],
      ["Pending", "pending"],
      ["Approved", "approved"],
      ["Rejected", "rejected"],
    ];
    for (const [label, status] of kpiMap) {
      const queuePromise = page.waitForResponse(
        (res) => res.url().includes("/admin/approvals/queue") && res.status() === 200
      );
      await page.getByRole("button", { name: new RegExp(label) }).click();
      await queuePromise;
      await expect(page.locator(`.approvals-kpi.is-active`).filter({ hasText: label })).toBeVisible();
      const statusValue = await page.locator('select.approvals-field__control').nth(1).inputValue();
      if (status !== "all") {
        expect(statusValue).toBe(status);
      }
      report.workflows.push(`KPI ${label}: status filter=${statusValue}`);
    }
  });

  test("search, type, status, and date filters", async ({ page }) => {
    trackDiagnostics(page);
    await loginAsAdmin(page);
    await page.goto(`${WEB_BASE}/admin/approvals`);
    await waitForApprovalsReady(page);
    await page.setViewportSize({ width: 1024, height: 768 });

    await page.getByPlaceholder(/request ID, employee, title or code/i).fill("e2e-no-match-xyz");
    await page.locator('select.approvals-field__control').first().selectOption("leave");
    await page.locator('select.approvals-field__control').nth(1).selectOption("approved");
    await page.locator('input[type="date"]').first().fill("2020-01-01");
    await page.locator('input[type="date"]').nth(1).fill("2030-12-31");

    const queuePromise = page.waitForResponse(
      (res) => res.url().includes("/admin/approvals/queue") && res.status() === 200
    );
    await page.getByRole("button", { name: "Apply Filters" }).click();
    const res = await queuePromise;
    expect(res.url()).toMatch(/search=e2e-no-match-xyz|search=e2e/);
    await expect(page.getByText(/No matching search results|No matching results/i)).toBeVisible({
      timeout: 15_000,
    });
    report.workflows.push("Apply Filters: narrow search + type/status/dates → empty results state shown.");

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(page.getByText("No Pending Approvals")).toBeVisible({ timeout: 15_000 });
    report.workflows.push("Reset: returned to default pending empty state.");
  });

  test("view dialog, reject validation, FAB clearance (non-destructive)", async ({ page }) => {
    trackDiagnostics(page);
    await loginAsAdmin(page);
    await page.goto(`${WEB_BASE}/admin/approvals`);
    await waitForApprovalsReady(page);
    await page.setViewportSize({ width: 1440, height: 900 });

    const viewButtons = page.getByRole("button", { name: "View" });
    const viewCount = await viewButtons.count();
    if (viewCount === 0) {
      report.notes.push("No pending rows with View action — skipped modal and reject-validation UI checks.");
      const fab = await fabOverlapsContent(page);
      if (fab.checked) {
        report.workflows.push(`FAB overlap check (empty state): overlaps=${fab.overlaps}`);
        expect(fab.overlaps).toBe(false);
      }
      return;
    }

    await viewButtons.first().click();
    await expect(page.locator(".approvals-modal")).toBeVisible();
    const modalBox = await page.locator(".approvals-modal").boundingBox();
    const viewport = page.viewportSize();
    expect(modalBox.x).toBeGreaterThanOrEqual(0);
    expect(modalBox.y).toBeGreaterThanOrEqual(0);
    expect(modalBox.x + modalBox.width).toBeLessThanOrEqual(viewport.width + 1);
    report.workflows.push("View: detail dialog visible and within viewport width.");
    await page.getByLabel("Close").click();
    await expect(page.locator(".approvals-modal")).toHaveCount(0);

    await page.getByRole("button", { name: "Reject" }).first().click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    const rejectBtn = page.getByRole("button", { name: /^Reject Leave$|^Reject$/ }).last();
    await expect(rejectBtn).toBeDisabled();
    report.workflows.push("Reject: confirm disabled with empty reason.");
    await page.getByRole("button", { name: "Cancel" }).click();

    await page.getByRole("button", { name: "Approve" }).first().click();
    await expect(page.getByRole("alertdialog")).toBeVisible();
    report.workflows.push("Approve: confirmation dialog opens (not confirmed — no data mutation).");
    await page.getByRole("button", { name: "Cancel" }).click();

    const fab = await fabOverlapsContent(page);
    if (fab.checked) {
      report.workflows.push(`FAB overlap check (with rows): overlaps=${fab.overlaps}`);
      expect(fab.overlaps).toBe(false);
    }
  });

  test("queue error state", async ({ page }) => {
    trackDiagnostics(page);
    await loginAsAdmin(page);
    let failOnce = true;
    await page.route("**/admin/approvals/queue**", (route) => {
      if (failOnce) {
        failOnce = false;
        return route.abort("failed");
      }
      return route.continue();
    });
    await page.goto(`${WEB_BASE}/admin/approvals`);
    await expect(page.getByText("Unable to load approvals")).toBeVisible({ timeout: 20_000 });
    report.workflows.push("Error state: simulated queue failure shows retry panel.");
    await page.getByRole("button", { name: "Try Again" }).click();
    await waitForApprovalsReady(page);
    report.workflows.push("Error recovery: Try Again reloads queue successfully.");
  });
});
