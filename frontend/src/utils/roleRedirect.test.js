import { describe, expect, it } from "vitest";

import { ACCOUNTS_DASHBOARD_PATH, getDashboardPathForRole } from "./roleRedirect";
import { userCanAccessPath } from "../config/permissions";

describe("roleRedirect", () => {
  it("uses canonical accounts dashboard path", () => {
    expect(ACCOUNTS_DASHBOARD_PATH).toBe("/accounts/dashboard");
  });

  it("routes accountant-like roles to accounts dashboard", () => {
    expect(getDashboardPathForRole("Accountant")).toBe("/accounts/dashboard");
    expect(getDashboardPathForRole({ role: "Accounts" })).toBe("/accounts/dashboard");
    expect(getDashboardPathForRole({ role_name: "Finance Manager" })).toBe("/accounts/dashboard");
  });

  it("does not send sales manager to accounts dashboard", () => {
    expect(getDashboardPathForRole("Sales Manager")).toBe("/sales");
  });
});

describe("accounts routes RBAC", () => {
  const accountant = { role: "Accountant", permissions: ["accounts", "dashboard", "sales"] };

  it("allows accountant on accounts dashboard and settings", () => {
    expect(userCanAccessPath(accountant, "/accounts/dashboard")).toBe(true);
    expect(userCanAccessPath(accountant, "/accounts/settings")).toBe(true);
  });

  it("blocks operator from accounts dashboard", () => {
    const operator = { role: "Operator", permissions: ["dashboard", "production"] };
    expect(userCanAccessPath(operator, "/accounts/dashboard")).toBe(false);
  });
});
