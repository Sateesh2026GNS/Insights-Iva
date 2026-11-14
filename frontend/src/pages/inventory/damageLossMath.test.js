import { describe, expect, it } from "vitest";

import { planDamage } from "./damageLossMath";

describe("planDamage", () => {
  it("matches the 19 Oct count against Tool 03 rates", () => {
    const plan = planDamage();
    const rice = plan.lines.find((row) => row.id === "rice");
    const cement = plan.lines.find((row) => row.id === "cement");
    const sugar = plan.lines.find((row) => row.id === "sugar");

    expect(plan.itemCount).toBe(12);
    expect(plan.systemQty).toBe(10270);
    expect(plan.goodCount).toBe(10243);
    expect(plan.damaged).toBe(20);
    expect(plan.lossUnits).toBe(27);
    expect(plan.lossValue).toBe(33580);
    expect(plan.stockValue).toBe(14738388);
    expect(plan.lossPct).toBeCloseTo(0.2278, 3);
    expect(plan.aboveLimit).toBe(1);
    expect(plan.excessItems).toBe(0);
    expect(plan.biggestName).toBe("Sugar 50 kg bag");
    expect(plan.topCause).toBe("Rats");
    expect(plan.noCauseValue).toBe(0);
    expect(plan.valueAxis).toBe(10000);

    expect(rice.shortage).toBe(3);
    expect(rice.lossUnits).toBe(7);
    expect(rice.lossValue).toBe(7974);
    expect(sugar.lossValue).toBe(8564);
    expect(sugar.check).toBe("Within limit");
    expect(cement.lossUnits).toBe(6);
    expect(cement.lossValue).toBe(2216);
    expect(cement.lossPct).toBeCloseTo(1.1538, 3);
    expect(cement.check).toBe("Above limit");
  });
});
