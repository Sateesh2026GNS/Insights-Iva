import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../tests/visual/operation-error-dialog.html");
const outDesktop = path.resolve(__dirname, "../tests/visual/operation-error-dialog-screenshot.png");
const outMobile = path.resolve(__dirname, "../tests/visual/operation-error-dialog-screenshot-mobile.png");

const browser = await chromium.launch();
for (const [outPath, viewport] of [
  [outDesktop, { width: 1280, height: 800 }],
  [outMobile, { width: 390, height: 844 }],
]) {
  const page = await browser.newPage({ viewport });
  await page.goto(`file://${htmlPath}`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved screenshot to ${outPath}`);
}
await browser.close();
