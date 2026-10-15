import { describe, expect, it } from "vitest";

import { ROLE_PERMISSIONS, userCanAccessPath } from "./permissions";

const ANALYTICS_ROUTES = [
  "/analytics",
  "/analytics/executive",
  "/analytics/live",
  "/analytics/production",
  "/analytics/inventory",
  "/analytics/sales",
  "/analytics/finance",
];

const accountant = { role: "Accountant", permissions: ROLE_PERMISSIONS.Accountant };
const admin = { role: "Admin", permissions: ["*"] };
const hrManager = { role: "HR Manager", permissions: ROLE_PERMISSIONS["HR Manager"] };

describe("Analytics child route authorization", () => {
  it.each(ANALYTICS_ROUTES)("Admin can open %s", (path) => {
    expect(userCanAccessPath(admin, path)).toBe(true);
  });

  it.each(["/analytics", "/analytics/executive", "/analytics/finance"])(
    "Accountant can open authorized Analytics path %s",
    (path) => {
      expect(userCanAccessPath(accountant, path)).toBe(true);
    }
  );

  it.each(["/analytics/live", "/analytics/production", "/analytics/inventory", "/analytics/sales"])(
    "Accountant cannot open unauthorized Analytics path %s",
    (path) => {
      expect(userCanAccessPath(accountant, path)).toBe(false);
    }
  );

  it("HR Manager can open Executive Dashboard but not domain KPI routes", () => {
    expect(userCanAccessPath(hrManager, "/analytics/executive")).toBe(true);
    expect(userCanAccessPath(hrManager, "/analytics/production")).toBe(false);
    expect(userCanAccessPath(hrManager, "/analytics/inventory")).toBe(false);
    expect(userCanAccessPath(hrManager, "/analytics/sales")).toBe(false);
    expect(userCanAccessPath(hrManager, "/analytics/finance")).toBe(false);
    expect(userCanAccessPath(hrManager, "/analytics/live")).toBe(false);
  });

  it("does not grant Sales KPI from the sales module alone", () => {
    const salesOnly = { role: "Custom", permissions: ["sales"] };
    expect(userCanAccessPath(salesOnly, "/analytics/sales")).toBe(false);
  });
});
