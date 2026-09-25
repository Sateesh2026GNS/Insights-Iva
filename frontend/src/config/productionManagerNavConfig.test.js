import { describe, expect, it } from "vitest";

import { PRODUCTION_MANAGER_NAV_ITEMS } from "./productionManagerNavConfig";
import { PRODUCTION_DASHBOARD_PATH } from "../utils/roleRedirect";

function allNavPaths() {
  const paths = [];
  for (const item of PRODUCTION_MANAGER_NAV_ITEMS) {
    if (item.to) paths.push(item.to.split("?")[0]);
    for (const child of item.children || []) {
      paths.push(child.to.split("?")[0]);
    }
  }
  return paths;
}

describe("productionManagerNavConfig", () => {
  it("uses the canonical production dashboard path", () => {
    const dash = PRODUCTION_MANAGER_NAV_ITEMS.find((n) => n.key === "dashboard");
    expect(dash?.to).toBe(PRODUCTION_DASHBOARD_PATH);
    expect(PRODUCTION_DASHBOARD_PATH).toBe("/production/dashboard");
  });

  it("does not include My Job Cards as a top-level item", () => {
    const keys = PRODUCTION_MANAGER_NAV_ITEMS.map((n) => n.key);
    expect(keys).not.toContain("myJobCards");
  });

  it("includes Production Queue under Production", () => {
    const production = PRODUCTION_MANAGER_NAV_ITEMS.find((n) => n.key === "production");
    const queue = production?.children?.find((c) => c.key === "productionQueue");
    expect(queue?.to).toContain("/my-job-cards");
    expect(queue?.to).toContain("dept=production");
  });

  it("omits procurement, masters, and incoming inspection", () => {
    const keys = PRODUCTION_MANAGER_NAV_ITEMS.map((n) => n.key);
    expect(keys).not.toContain("procurement");
    expect(keys).not.toContain("masters");
    const quality = PRODUCTION_MANAGER_NAV_ITEMS.find((n) => n.key === "quality");
    const paths = (quality?.children || []).map((c) => c.to);
    expect(paths).not.toContain("/quality/incoming");
  });

  it("includes Settings at /settings", () => {
    const settings = PRODUCTION_MANAGER_NAV_ITEMS.find((n) => n.key === "settings");
    expect(settings?.to).toBe("/settings");
    expect(settings?.module).toBe("settings");
  });

  it("includes Work Chat and production analytics", () => {
    const chat = PRODUCTION_MANAGER_NAV_ITEMS.find((n) => n.key === "chat");
    expect(chat?.to).toBe("/chat");
    const analytics = PRODUCTION_MANAGER_NAV_ITEMS.find((n) => n.key === "analytics");
    expect(analytics?.to).toBe("/analytics/production");
  });

  it("follows the target section order", () => {
    const keys = PRODUCTION_MANAGER_NAV_ITEMS.map((n) => n.key);
    expect(keys).toEqual([
      "dashboard",
      "production",
      "materials",
      "quality",
      "maintenance",
      "alerts",
      "documents",
      "meetings",
      "chat",
      "analytics",
      "settings",
    ]);
  });

  it("avoids duplicate nav paths except intentional production queue", () => {
    const paths = allNavPaths();
    const unique = new Set(paths);
    expect(unique.size).toBe(paths.length);
  });
});
