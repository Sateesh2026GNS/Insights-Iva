/**
 * Staging auth E2E prerequisites. Never set ACK=1 against production shared tenants.
 */

export function stagingEnvReport() {
  const ack = process.env.E2E_STAGING_ACK_NON_PRODUCTION === "1";
  const api = (process.env.E2E_STAGING_API_URL || "").trim();
  const web = (process.env.E2E_STAGING_BASE_URL || "").trim();
  const email = (process.env.E2E_STAGING_ADMIN_EMAIL || "").trim();
  const password = (process.env.E2E_STAGING_ADMIN_PASSWORD || "").trim();

  const missing = [];
  if (!ack) {
    return {
      ready: false,
      skipReason:
        "Set E2E_STAGING_ACK_NON_PRODUCTION=1 after confirming a dedicated non-production staging tenant.",
      missing: ["E2E_STAGING_ACK_NON_PRODUCTION"],
    };
  }
  if (!api) missing.push("E2E_STAGING_API_URL (HTTPS API base, e.g. https://api.staging.example.com)");
  if (!web) missing.push("E2E_STAGING_BASE_URL (HTTPS app base, e.g. https://app.staging.example.com)");
  if (api && !api.startsWith("https://")) missing.push("E2E_STAGING_API_URL must use https://");
  if (web && !web.startsWith("https://")) missing.push("E2E_STAGING_BASE_URL must use https://");
  if (!email) missing.push("E2E_STAGING_ADMIN_EMAIL (admin on dedicated staging tenant only)");
  if (!password) missing.push("E2E_STAGING_ADMIN_PASSWORD");

  return {
    ready: missing.length === 0,
    skipReason: missing.length
      ? `Staging auth blocked. Set:\n  - ${missing.join("\n  - ")}`
      : "",
    missing,
    api,
    web,
    email,
    password,
  };
}

export function requireStagingEnv(test) {
  const report = stagingEnvReport();
  if (!report.ready) {
    test.skip(true, report.skipReason);
  }
  return report;
}
