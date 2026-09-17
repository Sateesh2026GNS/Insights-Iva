import { describe, expect, it } from "vitest";

import { catalogStockReportMeta, historyReportMeta } from "./storeReportPageMeta";

describe("storeReportPageMeta", () => {
  it("describes stock issued empty state with dates", () => {
    const meta = historyReportMeta("out", { dateFrom: "2026-01-01", dateTo: "2026-01-01" });
    expect(meta.title).toBe("Stock Issued");
    expect(meta.emptyDescription).toMatch(/selected dates/i);
    expect(meta.quantityLabel).toBe("Quantity Issued");
  });

  it("describes low stock catalog report", () => {
    const meta = catalogStockReportMeta("low");
    expect(meta.title).toBe("Low Stock");
  });
});
