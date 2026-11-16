import { describe, expect, it } from "vitest";

import { STOCK_VALUE_OTHERS_KEY } from "./stockValueCategoryPalette";
import { buildStockValueDonutSlices } from "./stockValueCategorySlices";

describe("buildStockValueDonutSlices", () => {
  it("groups minor slices into Others and keeps top categories", () => {
    const raw = [
      { category: "A", value: 500, item_count: 5 },
      { category: "B", value: 300, item_count: 3 },
      { category: "C", value: 100, item_count: 2 },
      { category: "D", value: 50, item_count: 1 },
      { category: "E", value: 30, item_count: 1 },
      { category: "F", value: 20, item_count: 1 },
      { category: "G", value: 10, item_count: 1 },
      { category: "H", value: 5, item_count: 1 },
    ];
    const total = 1025;
    const slices = buildStockValueDonutSlices(raw, total);
    const others = slices.find((s) => s.category === STOCK_VALUE_OTHERS_KEY);
    expect(others).toBeTruthy();
    expect(slices.length).toBeLessThanOrEqual(7);
    expect(slices[0].category).toBe("A");
  });

  it("returns empty-ish display for no data", () => {
    expect(buildStockValueDonutSlices([], 0)).toEqual([]);
  });
});
