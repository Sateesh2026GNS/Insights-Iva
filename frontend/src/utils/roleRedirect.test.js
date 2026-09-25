import { describe, expect, it } from "vitest";

import {
  ACCOUNTS_DASHBOARD_PATH,
  PRODUCTION_DASHBOARD_PATH,
  QUALITY_CONTROL_LANDING_PATH,
  getDashboardPathForRole,
  withLoginRole,
} from "./roleRedirect";
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

  it("routes production manager to the production dashboard", () => {
    expect(PRODUCTION_DASHBOARD_PATH).toBe("/production/dashboard");
    expect(getDashboardPathForRole("Production Manager")).toBe("/production/dashboard");
    expect(getDashboardPathForRole({ role_name: "Production Manager" })).toBe("/production/dashboard");
    expect(getDashboardPathForRole({ role: "production_manager" })).toBe("/production/dashboard");
  });

  it("routes quality control to the role-aware dashboard", () => {
    expect(QUALITY_CONTROL_LANDING_PATH).toBe("/dashboard");
    expect(getDashboardPathForRole("Quality Control")).toBe("/dashboard");
    expect(getDashboardPathForRole({ role_name: "Quality Inspector" })).toBe("/dashboard");
  });

  it("withLoginRole applies the role selected on the login form", () => {
    expect(getDashboardPathForRole(withLoginRole({ id: 1, email: "qc@test.com" }, "Quality Control"))).toBe(
      "/dashboard"
    );
  });

  it("uses the active role for landing when multiple roles are present", () => {
    expect(
      getDashboardPathForRole({
        role_name: "Production Manager",
        roles: ["Store Manager", "Production Manager"],
      })
    ).toBe("/production/dashboard");
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
