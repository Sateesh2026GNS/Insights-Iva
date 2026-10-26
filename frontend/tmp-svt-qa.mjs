import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (err) => errors.push(String(err)));

await page.goto("http://127.0.0.1:5173/", { waitUntil: "domcontentloaded" });
await page.waitForSelector('select[aria-label="Role"]', { timeout: 20000 });
await page.selectOption('select[aria-label="Role"]', "Admin");
await page.fill('input[placeholder="Company Email"]', "admin@gnssoftwares.com");
await page.fill('input[placeholder="Password"]', "Admin123!");
await page.getByRole("button", { name: "SIGN IN" }).click();
await page.waitForURL((url) => !url.pathname.includes("login"), { timeout: 20000 });
await page.goto("http://127.0.0.1:5173/procurement/vendors/tracker", { waitUntil: "networkidle" });
await page.getByRole("heading", { name: "Supplier & Vendor Master Tracker" }).waitFor({ timeout: 20000 });

const crumb = await page.locator("nav").first().innerText();
const kpis = await page.locator(".svt-kpi").allInnerTexts();
const actions = await page.locator(".svt-action").allInnerTexts();
const sidebar = await page.locator("aside, nav").allInnerTexts();
const hasTrackerNav = sidebar.some((t) => t.includes("Supplier Tracker"));

console.log(JSON.stringify({
  url: page.url(),
  crumb: crumb.replace(/\s+/g, " ").slice(0, 240),
  kpiCount: kpis.length,
  kpis: kpis.map((t) => t.replace(/\s+/g, " ").trim()),
  actions: actions.map((t) => t.replace(/\s+/g, " ").trim()),
  hasTrackerNav,
  errors,
}, null, 2));

await page.screenshot({ path: "tmp-svt-qa.png", fullPage: true });
await browser.close();
