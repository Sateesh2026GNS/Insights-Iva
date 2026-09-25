import { describe, expect, it } from "vitest";

import { getBreadcrumbTrail, getPageTitle } from "./Breadcrumbs";

describe("Breadcrumbs production dashboard", () => {
  it("titles /production/dashboard as Dashboard, not Production Planning", () => {
    expect(getPageTitle("/production/dashboard")).toBe("Dashboard");
    const trail = getBreadcrumbTrail("/production/dashboard");
    expect(trail).toHaveLength(1);
    expect(trail[0].label).toBe("Dashboard");
  });

  it("titles /production/planning correctly", () => {
    expect(getPageTitle("/production/planning")).toBe("Production Planning");
    const trail = getBreadcrumbTrail("/production/planning");
    expect(trail[trail.length - 1].label).toBe("Production Planning");
  });

  it("still uses workflow stage labels on manufacturing workflow URLs", () => {
    expect(getPageTitle("/manufacturing/workflow/order/42/production")).toContain("Production Planning");
  });
});
