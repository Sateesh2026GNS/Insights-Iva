import { describe, expect, it } from "vitest";
import { computeSummary, enrichApiProduct, isProductLowStock } from "./productsMasterData";

describe("isProductLowStock", () => {
  it("returns false for null or undefined", () => {
    expect(isProductLowStock(null)).toBe(false);
    expect(isProductLowStock(undefined)).toBe(false);
  });

  it("identifies zero stock as low stock", () => {
    expect(isProductLowStock({ current_stock: 0, min_stock: 0 })).toBe(true);
    expect(isProductLowStock({ current_stock: 0, min_stock: 10 })).toBe(true);
    expect(isProductLowStock({ quantity: 0, min_stock: 0 })).toBe(true);
  });

  it("identifies negative stock as low stock", () => {
    expect(isProductLowStock({ current_stock: -5, min_stock: 10 })).toBe(true);
  });

  it("identifies positive stock at or below min_stock as low stock", () => {
    expect(isProductLowStock({ current_stock: 5, min_stock: 10 })).toBe(true);
    expect(isProductLowStock({ current_stock: 10, min_stock: 10 })).toBe(true);
    expect(isProductLowStock({ current_stock: 1, min_stock: 1 })).toBe(true);
  });

  it("returns false when stock is greater than min_stock", () => {
    expect(isProductLowStock({ current_stock: 11, min_stock: 10 })).toBe(false);
    expect(isProductLowStock({ current_stock: 50, min_stock: 0 })).toBe(false);
    expect(isProductLowStock({ current_stock: 99, min_stock: 20 })).toBe(false);
  });
});

describe("computeSummary", () => {
  it("accurately calculates total, active, inactive, lowStock and outOfStock counts", () => {
    const products = [
      enrichApiProduct({
        id: 149,
        name: "Steel rod",
        current_stock: 99,
        min_stock: 20,
        status: "active",
      }),
      enrichApiProduct({
        id: 162,
        name: "Cold Rolled Steel Sheet (CRCA 2mm)",
        current_stock: 0,
        min_stock: 0,
        status: "active",
      }),
      enrichApiProduct({
        id: 163,
        name: "Brass screw",
        current_stock: 3,
        min_stock: 10,
        status: "inactive",
      }),
    ];

    const summary = computeSummary(products);
    expect(summary.total).toBe(3);
    expect(summary.active).toBe(2);
    expect(summary.inactive).toBe(1);
    // Product 162 (stock 0) and Product 163 (stock 3 <= 10) are low stock
    expect(summary.lowStock).toBe(2);
    // Product 162 is out of stock (stock <= 0)
    expect(summary.outOfStock).toBe(1);
  });

  it("matches lowStock count for user database case (1 healthy, 1 zero stock)", () => {
    const products = [
      enrichApiProduct({
        id: 149,
        name: "Steel rod",
        current_stock: 99,
        min_stock: 20,
        status: "active",
      }),
      enrichApiProduct({
        id: 162,
        name: "Cold Rolled Steel Sheet (CRCA 2mm)",
        current_stock: 0,
        min_stock: 0,
        status: "active",
      }),
    ];

    const summary = computeSummary(products);
    expect(summary.total).toBe(2);
    expect(summary.active).toBe(2);
    expect(summary.lowStock).toBe(1);
  });
});
