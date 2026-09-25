import { describe, expect, it } from "vitest";

import {
  QUALITY_CONTROL_DASHBOARD_NAV_PATH,
  QUALITY_CONTROL_NAV_ITEMS,
  QUALITY_DASHBOARD_PATH,
} from "./qualityControlNavConfig";
import { qualityControlPathAllowed } from "./rbacNavFilters";

describe("qualityControlNavConfig", () => {
  it("lands top-level dashboard on the role-aware dashboard route", () => {
    const dash = QUALITY_CONTROL_NAV_ITEMS.find((n) => n.key === "dashboard");
    expect(dash?.to).toBe(QUALITY_CONTROL_DASHBOARD_NAV_PATH);
    expect(QUALITY_CONTROL_DASHBOARD_NAV_PATH).toBe("/dashboard");
    expect(QUALITY_DASHBOARD_PATH).toBe("/quality");
  });

  it("does not include masters, procurement, or full inventory admin", () => {
    const keys = QUALITY_CONTROL_NAV_ITEMS.map((n) => n.key);
    expect(keys).not.toContain("masters");
    expect(keys).not.toContain("procurement");
    expect(keys).not.toContain("inventory");
    const materials = QUALITY_CONTROL_NAV_ITEMS.find((n) => n.key === "materials");
    const paths = (materials?.children || []).map((c) => c.to);
    expect(paths).toEqual(["/inventory/raw-materials", "/inventory/finished-goods"]);
  });

  it("includes NCR via defects route and quality inspections", () => {
    const quality = QUALITY_CONTROL_NAV_ITEMS.find((n) => n.key === "quality");
    const paths = (quality?.children || []).map((c) => c.to);
    expect(paths).toContain("/quality/inspection");
    expect(paths).toContain("/quality/defects");
    expect(paths).not.toContain("/quality/compliance");
  });

  it("does not include CAPA (no canonical route)", () => {
    const flat = QUALITY_CONTROL_NAV_ITEMS.flatMap((n) =>
      n.children ? n.children.map((c) => c.label) : [n.label]
    );
    expect(flat.some((l) => /capa/i.test(l))).toBe(false);
  });

  it("includes work chat and settings", () => {
    expect(QUALITY_CONTROL_NAV_ITEMS.some((n) => n.key === "chat" && n.to === "/chat")).toBe(true);
    expect(QUALITY_CONTROL_NAV_ITEMS.some((n) => n.key === "settings" && n.to === "/settings")).toBe(true);
  });

  it("follows target section order", () => {
    expect(QUALITY_CONTROL_NAV_ITEMS.map((n) => n.key)).toEqual([
      "dashboard",
      "quality",
      "production",
      "materials",
      "alerts",
      "documents",
      "meetings",
      "chat",
      "analytics",
      "settings",
    ]);
  });
});

describe("qualityControlPathAllowed", () => {
  it("allows QC routes and blocks store procurement paths", () => {
    expect(qualityControlPathAllowed("/dashboard")).toBe(true);
    expect(qualityControlPathAllowed("/quality/incoming")).toBe(true);
    expect(qualityControlPathAllowed("/inventory/stock-ledger")).toBe(false);
    expect(qualityControlPathAllowed("/procurement/purchase-orders")).toBe(false);
    expect(qualityControlPathAllowed("/masters/products")).toBe(false);
    expect(qualityControlPathAllowed("/production/planning")).toBe(true);
    expect(qualityControlPathAllowed("/production/tasks")).toBe(false);
  });
});
