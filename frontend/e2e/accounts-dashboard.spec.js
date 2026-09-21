import { expect, test } from "@playwright/test";

test.describe("Accounts work control center", () => {
  test("dashboard loads and deep links navigate to AR, payments, and settings", async ({ page }) => {
    await page.goto("/accounts/dashboard");
    await expect(page.getByRole("heading", { name: "Accounts Dashboard" })).toBeVisible();
    await expect(page.getByText("Total Receivables")).toBeVisible();

    await page.locator('a[href="/finance/accounts-receivable?focus=overdue"]').first().click();
    await expect(page).toHaveURL(/\/finance\/accounts-receivable\?focus=overdue/);
    await expect(page.getByText(/aging analysis/i)).toBeVisible();

    await page.goto("/accounts/dashboard");
    await page.locator('a[href="/finance/payment-tracking?focus=pending"]').first().click();
    await expect(page).toHaveURL(/\/finance\/payment-tracking\?focus=pending/);
    await expect(page.getByRole("button", { name: /Record Payment/i })).toBeVisible();

    await page.goto("/accounts/dashboard");
    await page.locator('header a[href="/accounts/settings"]').click();
    await expect(page).toHaveURL(/\/accounts\/settings/);
    await expect(page.getByRole("heading", { name: "Accounts Settings" })).toBeVisible();

    await page.goto("/accounts/dashboard");
    await page.getByRole("button", { name: /Refresh/i }).click();
    await expect(page.getByRole("heading", { name: "Accounts Dashboard" })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("heading", { name: "Accounts Dashboard" })).toBeVisible();
  });
});
