import { describe, expect, it } from "vitest";

import { SAMPLE_UNIT_ITEMS, planUnitConverter } from "./unitConverterMath";

describe("planUnitConverter", () => {
  it("matches the wheat sample on the unit converter sheet", () => {
    const plan = planUnitConverter(SAMPLE_UNIT_ITEMS, { itemId: "wheat", quantity: 250, basis: "units" });

    expect(plan.itemCount).toBe(20);
    expect(plan.categoryCount).toBe(10);
    expect(plan.heaviestName).toBe("Wheat 50 kg bag");
    expect(plan.conversion.units).toBe(250);
    expect(plan.conversion.kg).toBe(12500);
    expect(plan.conversion.quintal).toBe(125);
    expect(plan.conversion.tonne).toBe(12.5);
    expect(plan.conversion.pieces).toBe(0);
    expect(plan.conversion.stacks).toBe(1);
    expect(plan.categories.find((cat) => cat.category === "Grains")?.pct).toBe(25);
  });

  it("derives master columns from kg, pieces, stack and cft", () => {
    const plan = planUnitConverter(SAMPLE_UNIT_ITEMS);
    const rice = plan.rows.find((row) => row.id === "rice");
    const biscuit = plan.rows.find((row) => row.id === "biscuit");
    const oil = plan.rows.find((row) => row.id === "oil");
    const mixed = plan.rows.find((row) => row.id === "mixed");

    expect(rice.unitsPerQuintal).toBe(4);
    expect(rice.unitsPerTonne).toBe(40);
    expect(rice.kgPerStack).toBe(12500);
    expect(rice.tonnesPerStack).toBe(12.5);
    expect(rice.cftPerTonne).toBe(58);

    expect(biscuit.unitsPerQuintal).toBeCloseTo(16.666, 2);
    expect(biscuit.kgPerPiece).toBeCloseTo(0.125, 3);
    expect(Math.round(biscuit.cftPerTonne)).toBe(133);

    expect(oil.kgPerStack).toBeCloseTo(1096, 3);
    expect(Math.round(oil.cftPerTonne)).toBe(66);
    expect(mixed.kgPerPiece).toBeCloseTo(0.833, 2);
  });

  it("rounds stacks up and converts pieces or kilograms back to units", () => {
    const wheat = SAMPLE_UNIT_ITEMS.find((row) => row.id === "wheat");
    const biscuit = SAMPLE_UNIT_ITEMS.find((row) => row.id === "biscuit");
    const full = planUnitConverter([wheat], { itemId: "wheat", quantity: 400, basis: "units" });
    const over = planUnitConverter([wheat], { itemId: "wheat", quantity: 401, basis: "units" });
    const fromKg = planUnitConverter([wheat], { itemId: "wheat", quantity: 5000, basis: "kg" });
    const fromPieces = planUnitConverter([biscuit], { itemId: "biscuit", quantity: 96, basis: "pieces" });

    expect(full.conversion.stacks).toBe(1);
    expect(over.conversion.stacks).toBe(2);
    expect(fromKg.conversion.units).toBe(100);
    expect(fromKg.conversion.quintal).toBe(50);
    expect(fromPieces.conversion.units).toBe(2);
    expect(fromPieces.conversion.kg).toBe(12);
    expect(fromPieces.conversion.pieces).toBe(96);
  });
});
