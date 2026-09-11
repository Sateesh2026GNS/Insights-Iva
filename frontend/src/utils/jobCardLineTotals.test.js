import { describe, expect, it } from "vitest";

import {
  applyProductMasterToLine,
  computeLineTotals,
  findDuplicateProductLineIndex,
  money,
  productSellingPrice,
  recalcProductLine,
} from "./jobCardLineTotals";

describe("jobCardLineTotals", () => {
  it("calculates line amount from quantity and price", () => {
    const line = recalcProductLine({ quantity: 5, unit_price: 250 });
    expect(line.line_amount).toBe(1250);
  });

  it("sums document totals", () => {
    const totals = computeLineTotals([
      { quantity: 2, unit_price: 500 },
      { quantity: 1, unit_price: 750 },
      { quantity: 3, unit_price: 1200 },
    ]);
    expect(totals.totalQuantity).toBe(6);
    expect(totals.totalAmount).toBe(5350);
  });

  it("loads price from product master fields", () => {
    expect(productSellingPrice({ unit_price: 1500 })).toBe(1500);
    const line = applyProductMasterToLine({ quantity: 1 }, { id: 1, name: "A", unit_price: 500, unit: "Nos" });
    expect(line.unit_price).toBe("500");
    expect(line.line_amount).toBe(500);
  });

  it("detects duplicate product rows", () => {
    const lines = [
      { product_id: "10", product_name: "A" },
      { product_id: "20", product_name: "B" },
    ];
    expect(findDuplicateProductLineIndex(lines, "20", 1)).toBe(-1);
    expect(findDuplicateProductLineIndex(lines, "10", 1)).toBe(0);
  });

  it("rounds money to two decimals", () => {
    expect(money(10.005)).toBe(10.01);
  });
});
