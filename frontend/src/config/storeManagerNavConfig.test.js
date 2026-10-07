import { describe, expect, it } from "vitest";

import { STORE_MANAGER_NAV_ITEMS } from "./storeManagerNavConfig";

function flattenChildren(nodes) {
  const labels = [];
  for (const node of nodes || []) {
    if (node.children) {
      for (const child of node.children) {
        labels.push({ label: child.label, to: child.to });
      }
    }
  }
  return labels;
}

describe("storeManagerNavConfig collaboration", () => {
  it("includes Meetings alongside Work Chat", () => {
    const meetings = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "meetings");
    expect(meetings?.to).toBe("/meetings");
    expect(meetings?.module).toBe("meetings");
  });
});

describe("storeManagerNavConfig reports", () => {
  it("points Reports to the reports catalog, not stock ledger", () => {
    const reports = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "reports");
    expect(reports?.to).toBe("/inventory/reports");
    expect(reports?.to).not.toBe("/inventory/stock-ledger");
    expect(reports?.to).not.toBe("/reports");
  });
});

describe("storeManagerNavConfig inventory submenu", () => {
  const inventory = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "inventory");
  const children = flattenChildren([inventory]);

  it("includes KPI destination pages", () => {
    const paths = children.map((c) => c.to?.split("?")[0]);
    expect(paths).toContain("/inventory/low-stock");
    expect(paths).toContain("/inventory/out-of-stock");
    expect(paths).toContain("/inventory/pending-inventory-checks");
    expect(paths).toContain("/inventory/todays-stock-out");
  });

  it("includes core inventory pages", () => {
    const paths = children.map((c) => c.to?.split("?")[0]);
    expect(paths).toContain("/inventory");
    expect(paths).toContain("/inventory/material-requests");
    expect(paths).toContain("/inventory/issue-materials");
  });
});
