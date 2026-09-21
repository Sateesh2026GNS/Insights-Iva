import { expect } from "@playwright/test";

/** Open the company ERP login form (role + email + password). */
export async function openCompanyLogin(page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  const roleSelect = page.locator('select[aria-label="Role"]');
  if ((await roleSelect.count()) === 0) {
    await page.goto("/gns-admin/login");
    await page.getByRole("link", { name: /Sign in here/i }).click();
    await page.waitForURL(/\/login\/?(\?.*)?$/);
  }
  await expect(roleSelect).toBeVisible({ timeout: 15_000 });
}
