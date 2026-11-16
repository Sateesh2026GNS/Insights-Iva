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

describe("storeManagerNavConfig purchases", () => {
  it("omits restricted purchase/stock pages for Store Manager only", () => {
    const purchases = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "purchases");
    const children = purchases?.children || [];
    expect(children.some((c) => c.key === "purchaseRequisitions")).toBe(false);
    expect(children.some((c) => c.to === "/procurement/material-requests")).toBe(false);
    expect(children.some((c) => c.label === "Purchase Requisitions")).toBe(false);
    expect(children.some((c) => c.key === "goodsReceipt")).toBe(false);
    expect(children.some((c) => c.to === "/procurement/goods-receipt")).toBe(false);
    expect(children.some((c) => /goods receipt|grn/i.test(c.label || ""))).toBe(false);
    expect(children.some((c) => c.key === "stockIn" || c.to === "/inventory/stock-in")).toBe(false);
    expect(children.some((c) => c.key === "supplierPayments" || c.to === "/procurement/supplier-payments")).toBe(
      false
    );
    expect(children.map((c) => c.key)).toContain("purchaseOrder");
    expect(children.map((c) => c.to)).toContain("/procurement/purchase-orders");
  });
});

describe("storeManagerNavConfig collaboration", () => {
  it("places Work Chat, My Job Cards, and Meetings immediately above Settings", () => {
    const keys = STORE_MANAGER_NAV_ITEMS.map((n) => n.key);
    const chatIdx = keys.indexOf("chat");
    const jobCardsIdx = keys.indexOf("myJobCards");
    const meetingsIdx = keys.indexOf("meetings");
    const settingsIdx = keys.indexOf("settings");
    expect(chatIdx).toBeGreaterThan(keys.indexOf("dashboard"));
    expect(jobCardsIdx).toBe(chatIdx + 1);
    expect(meetingsIdx).toBe(jobCardsIdx + 1);
    expect(settingsIdx).toBe(meetingsIdx + 1);
    expect(keys.indexOf("purchases")).toBeLessThan(chatIdx);
  });

  it("includes Meetings alongside Work Chat", () => {
    const meetings = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "meetings");
    expect(meetings?.to).toBe("/meetings");
    expect(meetings?.module).toBe("meetings");
  });
});

describe("storeManagerNavConfig masters", () => {
  it("includes Customers, Vendors, and Products under Masters", () => {
    const masters = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "masters");
    expect(masters?.children?.map((c) => c.label)).toEqual([
      "Customers",
      "Vendors",
      "Products",
    ]);
    expect(masters?.children?.map((c) => c.to)).toEqual([
      "/sales/customers",
      "/procurement/vendors",
      "/masters/products",
    ]);
  });
});

describe("storeManagerNavConfig reports", () => {
  it("keeps Inventory Reports on /inventory/reports and adds Reports Center", () => {
    const inventoryReports = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "reports");
    const center = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "reportsCenter");
    expect(inventoryReports?.to).toBe("/inventory/reports");
    expect(inventoryReports?.to).not.toBe("/inventory/stock-ledger");
    expect(center?.to).toBe("/reports");
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
    expect(paths).not.toContain("/inventory/todays-stock-out");
  });

  it("omits restricted inventory workflow pages", () => {
    const paths = children.map((c) => c.to?.split("?")[0]);
    expect(paths).not.toContain("/inventory/issue-materials");
    expect(paths).not.toContain("/inventory/stock-return");
    expect(paths).not.toContain("/inventory/stock-adjustment");
    expect(paths).not.toContain("/inventory/stock-ledger");
    expect(paths).not.toContain("/inventory/stock-in");
    expect(paths).not.toContain("/inventory/material-requests");
  });

  it("includes core inventory pages", () => {
    const paths = children.map((c) => c.to?.split("?")[0]);
    expect(paths).toContain("/inventory");
    expect(paths).toContain("/inventory/godown-planner");
    expect(children.find((c) => c.to === "/inventory/godown-planner")?.label).toBe("Godown Planner");
    expect(paths).toContain("/inventory/unit-converter");
    expect(children.find((c) => c.to === "/inventory/unit-converter")?.label).toBe("Unit Converter");
    expect(paths).toContain("/inventory/stock-valuation");
    expect(children.find((c) => c.to === "/inventory/stock-valuation")?.label).toBe("Stock Valuation");
    expect(paths).toContain("/inventory/eoq-helper");
    expect(children.find((c) => c.to === "/inventory/eoq-helper")?.label).toBe("EOQ Helper");
    expect(paths).toContain("/inventory/hamali-cost");
    expect(children.find((c) => c.to === "/inventory/hamali-cost")?.label).toBe("Hamali Cost");
    expect(paths).toContain("/inventory/truck-load");
    expect(children.find((c) => c.to === "/inventory/truck-load")?.label).toBe("Truck Load Planner");
    expect(paths).toContain("/inventory/damage-loss");
    expect(children.find((c) => c.to === "/inventory/damage-loss")?.label).toBe("Damage & Loss");
    expect(paths).toContain("/inventory/storage-quotation");
    expect(children.find((c) => c.to === "/inventory/storage-quotation")?.label).toBe("Storage Quotation");
    expect(paths).toContain("/inventory/gate-pass");
    expect(children.find((c) => c.to === "/inventory/gate-pass")?.label).toBe("Gate Pass");
    expect(paths).toContain("/inventory/godown-dashboard");
    expect(children.find((c) => c.to === "/inventory/godown-dashboard")?.label).toBe("Godown Dashboard");
  });

  it("includes manufacturing toolkit links for inventory register and raw materials", () => {
    const links = children.filter((c) => c.to?.startsWith("/production/planning"));
    expect(links.map((c) => c.label)).toEqual(["Inventory Register", "Raw Material Tracker"]);
    expect(links[0].to).toBe("/production/planning?toolkit=inventory_register");
    expect(links[1].to).toBe("/production/planning?toolkit=raw_material_tracker");
    const toolkitNav = inventory.children.filter((c) => c.to?.startsWith("/production/planning"));
    expect(toolkitNav[0].activeToolkit).toBe("inventory_register");
    expect(toolkitNav[1].activeToolkit).toBe("raw_material_tracker");
  });
});
