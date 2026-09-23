import { describe, expect, it } from "vitest";

import {
  isSalesManager,
  salesManagerPathAllowed,
  userCanAccessPath,
} from "./permissions";

const salesManager = { role: "Sales Manager" };

describe("Sales Manager route guard (verification)", () => {
  it("identifies Sales Manager role", () => {
    expect(isSalesManager(salesManager)).toBe(true);
    expect(isSalesManager({ role: "Admin" })).toBe(false);
  });

  const authorizedPaths = [
    "/sales",
    "/sales/dashboard",
    "/sales/leads",
    "/sales/quotations",
    "/sales/orders",
    "/sales/customers",
    "/sales/shipping",
    "/sales/dispatch",
    "/sales/reports/sales",
    "/sales/reports/sales-orders",
    "/sales/reports/quotations",
    "/sales/reports/customers",
    "/my-job-cards",
    "/my-job-cards?dept=sales",
    "/alerts",
    "/alerts/production-delay",
    "/documents",
    "/meetings",
    "/settings",
    "/settings/my-account",
  ];

  it.each(authorizedPaths)("allows sales workflow path %s", (path) => {
    expect(salesManagerPathAllowed(path)).toBe(true);
    expect(userCanAccessPath(salesManager, path)).toBe(true);
  });

  const blockedPaths = [
    "/admin/users",
    "/admin/roles",
    "/accounts/dashboard",
    "/finance/accounts-receivable",
    "/inventory",
    "/inventory/dashboard",
    "/maintenance",
    "/quality",
    "/alerts/safety",
    "/alerts/machine-failure",
    "/alerts/low-stock",
    "/analytics/executive",
    "/analytics/production",
    "/analytics/sales",
    "/production/planning",
    "/production/work-orders",
    "/procurement/purchase-orders",
    "/hr/attendance",
    "/hr/attendance/approval",
    "/hr/leave",
    "/hr/leave/approvals",
    "/hr/employees",
    "/hr/payroll",
  ];

  it.each(blockedPaths)("blocks unauthorized path %s", (path) => {
    expect(userCanAccessPath(salesManager, path)).toBe(false);
  });
});
