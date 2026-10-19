import { expect } from "@playwright/test";

/**
 * Log in on the staging SPA (cookie session). Does not log credentials.
 */
export async function loginStagingViaUi(page, env, { email, password, role }) {
  const web = env.web.replace(/\/$/, "");
  await page.goto(`${web}/login`);
  await page.locator('select[aria-label="Role"]').selectOption(role);
  await page.getByPlaceholder("Company Email").fill(email);
  await page.getByPlaceholder("Password").fill(password);
  await page.getByRole("button", { name: /^SIGN IN$/i }).click();
  await expect(page).not.toHaveURL(/\/login/, { timeout: 45_000 });
}

/**
 * API login against staging (sets cookies on APIRequestContext).
 */
export async function loginStagingApi(request, env, { email, password, role }) {
  const api = env.api.replace(/\/$/, "");
  await request.get(`${api}/auth/csrf`);
  const login = await request.post(`${api}/auth/login`, {
    data: { email, password, role },
  });
  expect(login.ok(), `staging login failed: ${login.status()}`).toBeTruthy();
  return login;
}
