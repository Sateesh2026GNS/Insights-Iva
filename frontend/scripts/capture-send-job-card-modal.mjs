import { chromium } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const htmlPath = path.resolve(__dirname, "../tests/visual/send-job-card-modal.html");
const outPath = path.resolve(__dirname, "../tests/visual/send-job-card-modal-screenshot.png");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`file://${htmlPath}`);
await page.waitForTimeout(250);
await page.screenshot({ path: outPath, fullPage: false });
console.log(`Saved screenshot to ${outPath}`);
await browser.close();
