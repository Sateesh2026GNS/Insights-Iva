import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_DIR = path.join(__dirname, ".auth");
const API_BASE = process.env.E2E_API_URL || "http://127.0.0.1:8000";
const WEB_BASE = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";
const PASSWORD = "Passw0rd!123";

async function loadE2eEnvFile() {
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
  } catch {
    /* optional file */
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

async function provisionUser(role, label) {
  const stamp = Date.now().toString(36);
  const email = `e2e-${label}-${stamp}@company-e2e.test`;
  const reg = await apiJson(`${API_BASE}/auth/register`, {
    company_name: `E2E ${label} ${stamp}`,
    full_name: `E2E ${role}`,
    email,
    password: PASSWORD,
    role,
  });
  if (!reg.ok) {
    throw new Error(
      `${API_BASE}/auth/register → ${reg.status}: ${reg.text.slice(0, 280)}. ` +
        "Set E2E_ACCOUNTANT_EMAIL/PASSWORD (and operator) in e2e/.env.e2e, or enable ALLOW_PUBLIC_REGISTRATION=true on the API."
    );
  }
  return loginUser(email, PASSWORD, role);
}

async function resolveAccount(role, label, envEmail, envPassword) {
  if (envEmail && envPassword) {
    try {
      return await loginUser(envEmail, envPassword, role);
    } catch {
      // Stored e2e credentials may target a different database than this run.
    }
  }
  return provisionUser(role, label);
}

async function saveStorageState(account, outFile) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.request.get(`${WEB_BASE}/auth/csrf`);
  const loginRes = await page.request.post(`${WEB_BASE}/auth/login`, {
    data: {
      email: account.email,
      password: account.password,
      role: account.role,
    },
  });
  if (!loginRes.ok()) {
    throw new Error(`Playwright login failed: ${loginRes.status()} ${await loginRes.text()}`);
  }
  const loginBody = await loginRes.json();
  const user = loginBody.user || account.user;
  await page.goto(`${WEB_BASE}/login`);
  await page.evaluate((u) => {
    localStorage.setItem("smrt-session-active", "1");
    localStorage.setItem("smrt-user", JSON.stringify(u));
    localStorage.setItem("smrt-login-time", String(Date.now()));
    localStorage.setItem("smrt-primary-heartbeat", String(Date.now()));
    localStorage.removeItem("smrt-token");
    localStorage.removeItem("smrt-refresh-token");
  }, user);
  await context.storageState({ path: outFile });
  await browser.close();
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
  await loadE2eEnvFile();
  // Manufacturing spec authenticates through the login UI and does not use
  // accountant/operator storage state. Skip Chromium provisioning so the spec
  // can skip cleanly when E2E_MANUFACTURING is unset or browsers are missing.
  if (isManufacturingOnlyRun() || isStoreManagerStagingOnlyRun()) {
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

  const credentials = {
    accountant: { email: accountant.email, password: accountant.password, role: accountant.role },
    operator: { email: operator.email, password: operator.password, role: operator.role },
  };
  await writeFile(path.join(AUTH_DIR, "credentials.json"), JSON.stringify(credentials, null, 2), "utf8");
}
