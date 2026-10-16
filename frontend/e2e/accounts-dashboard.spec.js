import { expect, test } from "@playwright/test";

test.describe("Accounts work control center", () => {
  test("dashboard loads and deep links navigate to AR, payables, and GST", async ({ page }) => {
    await page.goto("/accounts/dashboard");
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Total Receivables")).toBeVisible();
    await expect(page.getByText("Total Payables")).toBeVisible();

    await page.locator('a[href="/finance/accounts-receivable"]').first().click();
    await expect(page).toHaveURL(/\/finance\/accounts-receivable/);

    await page.goto("/accounts/dashboard");
    await page.locator('a[href="/accounts/accounts-payable"]').first().click();
    await expect(page).toHaveURL(/\/accounts\/accounts-payable/);

    await page.goto("/accounts/dashboard");
    await page.locator('a[href="/accounts/gst"]').first().click();
    await expect(page).toHaveURL(/\/accounts\/gst/);

    await page.goto("/accounts/dashboard");
    await expect(page.getByRole("button", { name: /Customise/i })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Dashboard", level: 1 })).toBeVisible();
    await expect(page.getByText("Total Receivables")).toBeVisible();
  });
});
