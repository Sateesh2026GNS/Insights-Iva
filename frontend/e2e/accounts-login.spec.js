import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { openCompanyLogin } from "./helpers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("Accountant UI login lands on accounts dashboard", async ({ page }) => {
  const raw = await readFile(path.join(__dirname, ".auth", "credentials.json"), "utf8");
  const { accountant } = JSON.parse(raw);

  await openCompanyLogin(page);
  await page.locator('select[aria-label="Role"]').selectOption(accountant.role);
  await page.getByPlaceholder("Company Email").fill(accountant.email);
  await page.getByPlaceholder("Password").fill(accountant.password);
  await page.getByRole("button", { name: /^SIGN IN$/i }).click();

  await expect(page).toHaveURL(/\/accounts\/dashboard/, { timeout: 20_000 });
  await expect(page.getByRole("heading", { name: "Accounts Dashboard" })).toBeVisible();
});
