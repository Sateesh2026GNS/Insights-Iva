import { describe, it, expect } from "vitest";

import { catalogStockReportMeta } from "./storeReportPageMeta";
import {
  filterInventoryStockRows,
  getInventoryStockItemTableHeaders,
  resolveInventoryKpiStockFilter,
  stockFilterFromPath,
} from "./inventoryStockItems";

const sampleProducts = [
  { id: 1, name: "Widget A", hsn_code: "1001", current_stock: 0, min_stock: 5, stock_value: 0 },
  { id: 2, name: "Widget B", hsn_code: "1002", current_stock: 3, min_stock: 10, stock_value: 300 },
  { id: 3, name: "Widget C", hsn_code: "1003", current_stock: 50, min_stock: 10, stock_value: 5000 },
];

describe("inventoryStockItems KPI resolution", () => {
  it("locks low stock from dedicated path or forced filter", () => {
    expect(stockFilterFromPath("/inventory/low-stock")).toBe("low");
    expect(stockFilterFromPath("/inventory/out-of-stock")).toBe("out");
    expect(
      resolveInventoryKpiStockFilter({
        pathname: "/inventory",
        searchParams: new URLSearchParams(),
        forcedStockFilter: "low",
      })
    ).toBe("low");
  });
});

describe("filterInventoryStockRows", () => {
  it("returns only out-of-stock rows", () => {
    const rows = filterInventoryStockRows(sampleProducts, { stockFilter: "out" });
    expect(rows.map((r) => r.id)).toEqual([1]);
  });

  it("returns only low-stock rows (qty > 0 and at or below min)", () => {
    const rows = filterInventoryStockRows(sampleProducts, { stockFilter: "low" });
    expect(rows.map((r) => r.id)).toEqual([2]);
  });
});

describe("getInventoryStockItemTableHeaders", () => {
  it("uses distinct columns for low vs out KPI pages", () => {
    expect(getInventoryStockItemTableHeaders("low")).toEqual([
      "HSN Code",
      "Item Name",
      "Available Quantity",
      "Minimum Stock Level",
      "Stock Value",
      "Action",
    ]);
    expect(getInventoryStockItemTableHeaders("out")).toEqual([
      "HSN Code",
      "Item Name",
      "Available Quantity",
      "Stock Value",
      "Action",
    ]);
    expect(getInventoryStockItemTableHeaders("out")).not.toContain("Minimum Stock Level");
  });
});

describe("catalog empty states for KPI pages", () => {
  it("provides page-specific empty titles", () => {
    expect(catalogStockReportMeta("low").emptyTitle).toBe("No low stock items");
    expect(catalogStockReportMeta("out").emptyTitle).toBe("No out of stock items");
  });
});
