import { describe, expect, it } from "vitest";

import { getBreadcrumbTrail, getPageTitle } from "./Breadcrumbs";

describe("Breadcrumbs sales manager dashboard", () => {
  it("uses Dashboard title for canonical /sales route", () => {
    expect(getPageTitle("/sales")).toBe("Dashboard");
    expect(getPageTitle("/sales/")).toBe("Dashboard");
  });

  it("shows Home > Dashboard trail for /sales", () => {
    const trail = getBreadcrumbTrail("/sales");
    expect(trail).toHaveLength(2);
    expect(trail[0]).toEqual({ label: "Dashboard", path: "/" });
    expect(trail[1]).toEqual({ label: "Dashboard", path: "/sales" });
  });

  it("keeps child sales routes unchanged", () => {
    expect(getPageTitle("/sales/leads")).toBe("Leads");
    expect(getPageTitle("/sales/quotations")).toBe("Quotations");
    expect(getPageTitle("/sales/orders")).toBe("Sales Orders");
    expect(getPageTitle("/sales/customers")).toBe("Customers");
  });
});
