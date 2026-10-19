/**
 * Staging auth E2E prerequisites. Never set ACK=1 against production shared tenants.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Load optional `e2e/.env.e2e` without overwriting existing process.env. */
export async function loadStagingE2eEnvFile() {
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
    /* optional */
  }
}

function baseStagingReport() {
  const ack = process.env.E2E_STAGING_ACK_NON_PRODUCTION === "1";
  const api = (process.env.E2E_STAGING_API_URL || "").trim();
  const web = (process.env.E2E_STAGING_BASE_URL || "").trim();

  const missing = [];
  if (!ack) {
    return {
      ready: false,
      skipReason:
        "Set E2E_STAGING_ACK_NON_PRODUCTION=1 after confirming a dedicated non-production staging tenant.",
      missing: ["E2E_STAGING_ACK_NON_PRODUCTION"],
      api,
      web,
    };
  }
  if (!api) missing.push("E2E_STAGING_API_URL (HTTPS API base, e.g. https://api.staging.example.com)");
  if (!web) missing.push("E2E_STAGING_BASE_URL (HTTPS app base, e.g. https://app.staging.example.com)");
  if (api && !api.startsWith("https://")) missing.push("E2E_STAGING_API_URL must use https://");
  if (web && !web.startsWith("https://")) missing.push("E2E_STAGING_BASE_URL must use https://");

  return {
    ready: missing.length === 0,
    skipReason: missing.length ? `Staging blocked. Set:\n  - ${missing.join("\n  - ")}` : "",
    missing,
    api,
    web,
  };
}

export function stagingEnvReport() {
  const base = baseStagingReport();
  if (!base.ready) return { ...base, email: "", password: "" };

  const email = (process.env.E2E_STAGING_ADMIN_EMAIL || "").trim();
  const password = (process.env.E2E_STAGING_ADMIN_PASSWORD || "").trim();
  const missing = [...base.missing];
  if (!email) missing.push("E2E_STAGING_ADMIN_EMAIL (admin on dedicated staging tenant only)");
  if (!password) missing.push("E2E_STAGING_ADMIN_PASSWORD");

  return {
    ...base,
    ready: missing.length === base.missing.length,
    skipReason: missing.length
      ? `Staging auth blocked. Set:\n  - ${missing.join("\n  - ")}`
      : "",
    missing,
    email,
    password,
  };
}

/** Store Manager toolkit staging — requires base HTTPS staging URLs + dedicated SM account. */
export function stagingStoreManagerEnvReport() {
  const base = baseStagingReport();
  const smEmail = (process.env.E2E_STAGING_STORE_MANAGER_EMAIL || "").trim();
  const smPassword = (process.env.E2E_STAGING_STORE_MANAGER_PASSWORD || "").trim();
  const smRole = (process.env.E2E_STAGING_STORE_MANAGER_ROLE || "Store Manager").trim();

  if (!base.ready) {
    return {
      ...base,
      storeManager: { email: smEmail, password: smPassword, role: smRole },
    };
  }

  const missing = [...base.missing];
  if (!smEmail) {
    missing.push(
      "E2E_STAGING_STORE_MANAGER_EMAIL (Store Manager on dedicated non-production staging tenant)"
    );
  }
  if (!smPassword) missing.push("E2E_STAGING_STORE_MANAGER_PASSWORD");

  return {
    ...base,
    ready: missing.length === base.missing.length,
    skipReason: missing.length
      ? `Store Manager staging blocked. Set:\n  - ${missing.join("\n  - ")}`
      : "",
    missing,
    storeManager: {
      email: smEmail,
      password: smPassword,
      role: smRole,
    },
  };
}

export function requireStagingEnv(test) {
  const report = stagingEnvReport();
  if (!report.ready) {
    test.skip(true, report.skipReason);
  }
  return report;
}

export function requireStagingStoreManagerEnv(test) {
  const report = stagingStoreManagerEnvReport();
  if (!report.ready) {
    test.skip(true, report.skipReason);
  }
  return report;
}
