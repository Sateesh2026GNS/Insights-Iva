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

async function apiJson(url, body) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
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
    access_token: login.data.access_token,
    refresh_token: login.data.refresh_token,
    user: login.data.user,
  };
}

async function provisionUser(role, label) {
  const stamp = Date.now().toString(36);
  const email = `e2e-${label}-${stamp}@example.com`;
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
    return loginUser(envEmail, envPassword, role);
  }
  return provisionUser(role, label);
}

async function saveStorageState(account, outFile) {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${WEB_BASE}/login`);
  await page.evaluate(
    ({ access_token, refresh_token, user }) => {
      localStorage.setItem("smrt-token", access_token);
      if (refresh_token) localStorage.setItem("smrt-refresh-token", refresh_token);
      localStorage.setItem("smrt-user", JSON.stringify(user));
      localStorage.setItem("smrt-login-time", String(Date.now()));
      localStorage.setItem("smrt-primary-heartbeat", String(Date.now()));
    },
    account
  );
  await context.storageState({ path: outFile });
  await browser.close();
}

export default async function globalSetup() {
  await loadE2eEnvFile();
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
