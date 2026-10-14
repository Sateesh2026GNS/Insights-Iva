import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPath = path.resolve(__dirname, "../tests/visual/job-card-form-live-screenshot.png");
const baseUrl = process.env.PREVIEW_URL || "http://127.0.0.1:4173";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto(`${baseUrl}/sales/job-cards/create`, { waitUntil: "networkidle", timeout: 60_000 });

const onLogin = await page.locator('select[aria-label="Role"]').isVisible().catch(() => false);
if (onLogin) {
  console.log("LIVE_APP: redirected to login — cannot capture authenticated Job Card form without credentials.");
  await page.screenshot({ path: outPath.replace(".png", "-login.png"), fullPage: true });
} else {
  const company = page.getByText("Company Name", { exact: false }).first();
  await company.waitFor({ timeout: 15_000 }).catch(() => {});
  const hasForm = await page.locator(".manual-sjc-form").count();
  console.log(`LIVE_APP: manual-sjc-form count=${hasForm}`);
  if (hasForm) {
    const metrics = await page.evaluate(() => {
      const pick = (sel) => {
        const el = document.querySelector(sel);
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return Math.round(r.height);
      };
      return {
        searchableSelect: pick(".manual-sjc-form .ui-searchable-select"),
        dateCompact: pick(".manual-sjc-form .ui-date-compact"),
        nativeSelect: pick(".manual-sjc-form select.sjc-doc__input, .manual-sjc-form select.ui-select"),
      };
    });
    console.log("LIVE_APP metrics:", JSON.stringify(metrics));
  }
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved live screenshot to ${outPath}`);
}
await browser.close();
