import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, ".auth");
const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const WEB_BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

async function loadE2eEnvFile({ required = false } = {}) {
  const envPath = path.join(__dirname, ".env.e2e");
  try {
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
  } catch (error) {
    if (required || error.code !== "ENOENT") throw error;
  }
}

async function apiJson(url, body, { method = "POST" } = {}) {
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  return { ok: res.ok, status: res.status, data, text };
}

async function loginUser(email, password, role) {
  const login = await apiJson(`${API_BASE}/auth/login`, { email, password, role });
  if (!login.ok) {
    throw new Error(`Login failed for ${role} (${email}): ${login.status} ${login.text.slice(0, 200)}`);
  }
  return {
    email,
    password,
    role,
    user: login.data.user,
  };
}

async function resolveAccount(role, label, envEmail, envPassword) {
  if (!envEmail || !envPassword) {
    throw new Error(`Missing local E2E credentials for ${role}; seed a local test tenant first.`);
  }
  return loginUser(envEmail, envPassword, role);
}

async function saveStorageState(account, outFile, webBase = WEB_BASE) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.request.get(`${webBase}/auth/csrf`);
    const loginRes = await page.request.post(`${webBase}/auth/login`, {
      data: {
        email: account.email,
        password: account.password,
        role: account.role,
      },
    });
    if (!loginRes.ok()) {
      throw new Error(`Playwright login failed for ${account.role}: HTTP ${loginRes.status()}.`);
    }
    const loginBody = await loginRes.json();
    const user = loginBody.user || account.user;
    if (!user) throw new Error(`Playwright login for ${account.role} returned no user profile.`);
    await page.goto(`${webBase}/login`);
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
    await context.storageState({ path: outFile });
    await context.close();
  } finally {
    await browser.close();
  }
}

const RESPONSIVE_ROLES = [
  ["Admin", "ADMIN", "admin"],
  ["HR Manager", "HR", "hr"],
  ["Sales Manager", "SALES", "sales"],
  ["Store Manager", "STORE", "store"],
  ["Production Manager", "PRODUCTION", "production"],
  ["Operator", "OPERATOR", "operator"],
  ["Quality Control", "QUALITY", "quality"],
];

function isResponsiveOnlyRun() {
  return process.argv.join(" ").includes("responsive-certification.spec.js");
}

function assertLoopbackUrl(value, label) {
  const url = new URL(value);
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1", "::1"].includes(url.hostname)) {
    throw new Error(`${label} must use local HTTP loopback; refusing to authenticate against a remote host.`);
  }
}

function isApprovalsVerificationOnlyRun() {
  const args = process.argv.join(" ");
  return (
    /--project[= ]approvals-verification\b/.test(args) ||
    /approvals-page-verification\.spec\.js/.test(args)
  );
}

function isLiveLoginOnlyRun() {
  const args = process.argv.join(" ");
  return /--project[= ]auth-live-login\b/.test(args) || /auth-live-login-logout\.spec\.js/.test(args);
}

function isManufacturingOnlyRun() {
  const args = process.argv.join(" ");
  return /--project[= ]manufacturing\b/.test(args) || /manufacturing-workflow\.spec\.js/.test(args);
}

function isStoreManagerStagingOnlyRun() {
  const args = process.argv.join(" ");
  return (
    /--project[= ]store-manager-staging\b/.test(args) ||
    /store-manager-inventory-toolkit-staging\.spec\.js/.test(args)
  );
}

export default async function globalSetup() {
  const responsiveOnly = isResponsiveOnlyRun();
  await loadE2eEnvFile({ required: responsiveOnly });
  if (responsiveOnly) {
    const webBase = process.env.E2E_BASE_URL || WEB_BASE;
    const apiBase = process.env.E2E_API_URL || API_BASE;
    assertLoopbackUrl(webBase, "E2E_BASE_URL");
    assertLoopbackUrl(apiBase, "E2E_API_URL");
    await mkdir(AUTH_DIR, { recursive: true });

    for (const [role, key, file] of RESPONSIVE_ROLES) {
      const email = process.env[`E2E_${key}_EMAIL`];
      const password = process.env[`E2E_${key}_PASSWORD`];
      if (!email || !password) {
        throw new Error(`Missing E2E_${key}_EMAIL or E2E_${key}_PASSWORD in frontend/e2e/.env.e2e.`);
      }
      await saveStorageState({ email, password, role }, path.join(AUTH_DIR, `${file}.json`), webBase);
      console.log(`Created local authenticated browser state for ${role}.`);
    }
    return;
  }

  // Manufacturing spec authenticates through the login UI and does not use
  // accountant/operator storage state. Skip Chromium provisioning so the spec
  // can skip cleanly when E2E_MANUFACTURING is unset or browsers are missing.
  if (
    isManufacturingOnlyRun() ||
    isStoreManagerStagingOnlyRun() ||
    isApprovalsVerificationOnlyRun() ||
    isLiveLoginOnlyRun()
  ) {
    return;
  }
  await mkdir(AUTH_DIR, { recursive: true });

  const accountant = await resolveAccount(
    "Accountant",
    "acct",
    process.env.E2E_ACCOUNTANT_EMAIL,
    process.env.E2E_ACCOUNTANT_PASSWORD
  );
  const operator = await resolveAccount(
    "Operator",
    "op",
    process.env.E2E_OPERATOR_EMAIL,
    process.env.E2E_OPERATOR_PASSWORD
  );

  await saveStorageState(accountant, path.join(AUTH_DIR, "accountant.json"));
  await saveStorageState(operator, path.join(AUTH_DIR, "operator.json"));
}
