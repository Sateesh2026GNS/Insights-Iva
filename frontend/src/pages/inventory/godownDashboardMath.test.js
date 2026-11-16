import { describe, expect, it } from "vitest";

import { planGodownDashboard } from "./godownDashboardMath";

describe("planGodownDashboard", () => {
  it("matches the toolkit sample cards", () => {
    const plan = planGodownDashboard();
    expect(plan.fullPct).toBe(68.8);
    expect(plan.freeSqft).toBe(875);
    expect(plan.stockValue).toBe(16613674);
    expect(plan.stockUnits).toBe(11450);
    expect(plan.hamaliMonth).toBe(129480);
    expect(plan.trucks).toBe(4);
    expect(plan.freightPerUnit).toBe(40);
    expect(plan.eoqOrder).toBe(450);
    expect(plan.lossValue).toBe(33580);
    expect(plan.quoteTotal).toBe(75850);
    expect(plan.gateKg).toBe(13411);
    expect(plan.costPerBag).toBeCloseTo(11.29, 2);
    expect(plan.rows.find((row) => row.tool === "14").value).toContain("8,360");
    expect(plan.rows.find((row) => row.tool === "13").to).toBe("/inventory/gate-pass");
  });
});
