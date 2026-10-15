import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../tests/visual/job-card-form-controls.html");
const outDesktop = path.resolve(__dirname, "../tests/visual/job-card-form-controls-screenshot.png");
const outMobile = path.resolve(__dirname, "../tests/visual/job-card-form-controls-screenshot-mobile.png");

const browser = await chromium.launch();
for (const [outPath, viewport] of [
  [outDesktop, { width: 1280, height: 800 }],
  [outMobile, { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`file://${htmlPath}`);
  await page.waitForTimeout(300);

  const metrics = await page.evaluate(() => {
    const pick = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return {
        height: Math.round(r.height),
        paddingTop: s.paddingTop,
        paddingBottom: s.paddingBottom,
        paddingLeft: s.paddingLeft,
        borderRadius: s.borderRadius,
        fontSize: s.fontSize,
      };
    };
    return {
      searchableSelect: pick(".ui-searchable-select"),
      dateCompact: pick(".ui-date-compact"),
      nativeSelect: pick("select.ui-select"),
    };
  });
  console.log(`Metrics (${viewport.width}px):`, JSON.stringify(metrics, null, 2));

  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved screenshot to ${outPath}`);
}
await browser.close();
