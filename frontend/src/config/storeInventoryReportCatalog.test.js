import { describe, expect, it } from "vitest";

import {
  getReportsByCategory,
  getStoreInventoryReportLinks,
  STORE_INVENTORY_REPORTS,
  STORE_STOCK_LEDGER_PATH,
  storeStockIssuedTodayPath,
} from "./storeInventoryReportCatalog";

const ALLOWED_PREFIXES = ["/inventory", "/procurement/goods-receipt"];

function hrefAllowed(href) {
  return ALLOWED_PREFIXES.some((p) => href === p || href.startsWith(`${p}`));
}

describe("storeInventoryReportCatalog", () => {
  it("lists store/inventory report destinations only (no accounting)", () => {
    const links = getStoreInventoryReportLinks();
    expect(links.length).toBe(11);
    for (const row of links) {
      expect(hrefAllowed(row.href.split("?")[0])).toBe(true);
      expect(row.href).not.toMatch(/^\/reports/);
      expect(row.href).not.toMatch(/^\/accounts\//);
    }
    expect(links.some((r) => r.id === "stock-ledger")).toBe(false);
  });

  it("groups reports into categories for the hub UI", () => {
    const sections = getReportsByCategory();
    expect(sections.length).toBeGreaterThan(0);
    const total = sections.reduce((n, s) => n + s.reports.length, 0);
    expect(total).toBe(11);
  });

  it("exposes stock ledger separately from report cards", () => {
    expect(STORE_STOCK_LEDGER_PATH).toBe("/inventory/stock-ledger");
  });

  it("builds today's stock issued path for dashboard KPI alignment", () => {
    expect(storeStockIssuedTodayPath("2026-03-16")).toContain("type=out");
    expect(storeStockIssuedTodayPath("2026-03-16")).toContain("from=2026-03-16");
  });

  it("includes user-facing report ids", () => {
    const ids = new Set(STORE_INVENTORY_REPORTS.filter((r) => r.available).map((r) => r.id));
    expect(ids.has("low-stock")).toBe(true);
    expect(ids.has("stock-issued")).toBe(true);
    expect(ids.has("pending-stock-transfers")).toBe(true);
    expect(ids.has("purchase-receipts")).toBe(true);
  });
});
