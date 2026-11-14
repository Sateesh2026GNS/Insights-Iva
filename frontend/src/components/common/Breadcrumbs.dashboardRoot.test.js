import { describe, expect, it } from "vitest";

import {
  getBreadcrumbTrail,
  getPageTitle,
  getVisibleBreadcrumbItems,
  isErpDashboardRoot,
  isRoleDashboardHome,
  shouldShowNavbarBreadcrumb,
} from "./Breadcrumbs";

describe("role dashboard home breadcrumbs", () => {
  it("detects every role dashboard home path", () => {
    for (const path of [
      "/",
      "/dashboard",
      "/dashboard/",
      "/inventory/dashboard",
      "/sales",
      "/production/dashboard",
      "/hr",
      "/accounts/dashboard",
      "/procurement",
    ]) {
      expect(isRoleDashboardHome(path)).toBe(true);
      expect(isErpDashboardRoot(path)).toBe(true);
      expect(shouldShowNavbarBreadcrumb(path)).toBe(false);
      expect(getVisibleBreadcrumbItems(path)).toEqual([]);
    }
  });

  it("does not treat nested routes as dashboard homes", () => {
    expect(isRoleDashboardHome("/admin/users")).toBe(false);
    expect(isRoleDashboardHome("/sales/leads")).toBe(false);
    expect(isRoleDashboardHome("/inventory/warehouses")).toBe(false);
  });

  it("keeps page title Dashboard on role dashboard homes", () => {
    expect(getPageTitle("/")).toBe("Dashboard");
    expect(getPageTitle("/dashboard")).toBe("Dashboard");
    expect(getPageTitle("/inventory/dashboard")).toBe("Dashboard");
    expect(getPageTitle("/sales")).toBe("Dashboard");
    expect(getPageTitle("/production/dashboard")).toBe("Dashboard");
    expect(getPageTitle("/hr")).toBe("Dashboard");
    expect(getPageTitle("/accounts/dashboard")).toBe("Dashboard");
  });

  it("uses a single-segment trail on dashboard homes (navbar still hides the row)", () => {
    expect(getBreadcrumbTrail("/")).toEqual([{ label: "Dashboard", path: "/" }]);
    expect(getBreadcrumbTrail("/dashboard")).toEqual([
      { label: "Dashboard", path: "/dashboard" },
    ]);
    expect(getBreadcrumbTrail("/inventory/dashboard")).toEqual([
      { label: "Dashboard", path: "/inventory/dashboard" },
    ]);
  });

  it("hides breadcrumb on dashboard routes and shows distinct crumbs on nested routes", () => {
    expect(shouldShowNavbarBreadcrumb("/inventory/dashboard", "Dashboard")).toBe(false);
    expect(getVisibleBreadcrumbItems("/inventory/dashboard", "Dashboard")).toEqual([]);

    const title = getPageTitle("/sales/leads");
    expect(title).toBe("Leads");
    const items = getVisibleBreadcrumbItems("/sales/leads", title);
    expect(shouldShowNavbarBreadcrumb("/sales/leads", title)).toBe(true);
    expect(items.length).toBeGreaterThan(1);
    expect(items[items.length - 1].label).not.toBe(title);
    expect(items.map((item) => item.label)).toContain("Sales");
  });

  it("preserves multi-segment breadcrumbs on other pages", () => {
    const adminTrail = getBreadcrumbTrail("/admin/users");
    expect(adminTrail.length).toBeGreaterThan(1);
    expect(adminTrail.map((item) => item.label)).toContain("Administration");
  });
});
