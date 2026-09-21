import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL || "http://127.0.0.1:5173";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.js",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "accountant",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/accountant.json",
      },
      testMatch: /accounts-dashboard\.spec\.js/,
    },
    {
      name: "accountant-login",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /accounts-login\.spec\.js/,
    },
    {
      name: "operator",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/operator.json",
      },
      testMatch: /accounts-operator\.spec\.js/,
    },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
