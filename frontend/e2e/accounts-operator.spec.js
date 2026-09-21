import { expect, test } from "@playwright/test";

test("Operator cannot open accounts dashboard", async ({ page }) => {
  await page.goto("/accounts/dashboard");
  await expect(page.getByText(/do not have permission/i)).toBeVisible();
});
