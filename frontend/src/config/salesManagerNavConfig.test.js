import { describe, expect, it } from "vitest";

import { SALES_MANAGER_NAV_ITEMS } from "./salesManagerNavConfig";
import { SALES_DASHBOARD_PATH } from "../utils/roleRedirect";

describe("salesManagerNavConfig", () => {
  it("uses one canonical dashboard route", () => {
    const dashboard = SALES_MANAGER_NAV_ITEMS.find((n) => n.key === "dashboard");
    expect(dashboard?.to).toBe(SALES_DASHBOARD_PATH);
    expect(dashboard?.end).toBe(true);
    const sales = SALES_MANAGER_NAV_ITEMS.find((n) => n.key === "sales");
    const childLabels = (sales?.children || []).map((c) => c.label);
    expect(childLabels).not.toContain("Sales Dashboard");
  });

  it("does not expose unrelated module sections", () => {
    const keys = SALES_MANAGER_NAV_ITEMS.map((n) => n.key);
    expect(keys).not.toContain("maintenance");
    expect(keys).not.toContain("quality");
    expect(keys).not.toContain("analytics");
    expect(keys).not.toContain("myJobCards");
    expect(keys).not.toContain("payments");
    expect(keys).not.toContain("masters");
  });

  it("includes sales workflow and order management links without work orders", () => {
    const salesPaths = (SALES_MANAGER_NAV_ITEMS.find((n) => n.key === "sales")?.children || []).map(
      (c) => c.to
    );
    expect(salesPaths).toContain("/sales/leads");
    expect(salesPaths).toContain("/sales/quotations");
    expect(salesPaths).toContain("/sales/orders");

    const orderPaths = (SALES_MANAGER_NAV_ITEMS.find((n) => n.key === "orderManagement")?.children || []).map(
      (c) => c.to?.split("?")[0]
    );
    expect(orderPaths).toContain("/my-job-cards");
    expect(orderPaths).not.toContain("/production/work-orders");
    expect(orderPaths).toContain("/sales/shipping");
  });

  it("exposes sales-scoped report routes", () => {
    const reportPaths = (SALES_MANAGER_NAV_ITEMS.find((n) => n.key === "reports")?.children || []).map(
      (c) => c.to
    );
    expect(reportPaths).toEqual([
      "/sales/reports/sales",
      "/sales/reports/sales-orders",
      "/sales/reports/quotations",
      "/sales/reports/customers",
    ]);
  });
});
