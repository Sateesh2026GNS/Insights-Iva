import { describe, expect, it } from "vitest";

import { planGatePass } from "./gatePassMath";

describe("planGatePass", () => {
  it("matches the Om Agro Foods delivery challan", () => {
    const plan = planGatePass();
    expect(plan.documentNo).toBe("DC/2026-27/0412");
    expect(plan.lineCount).toBe(4);
    expect(plan.totalQty).toBe(350);
    expect(plan.rows[0].weight).toBe(8000);
    expect(plan.rows[3].weight).toBe(411);
    expect(plan.totalKg).toBe(13411);
    expect(plan.tonnes).toBeCloseTo(13.411, 3);
    expect(plan.party).toBe("Om Agro Foods");
    expect(plan.vehicle).toBe("RJ 14 GE 3317");
  });
});
