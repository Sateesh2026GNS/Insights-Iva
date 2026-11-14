import { describe, expect, it } from "vitest";

import { SAMPLE_TRUCK_LOG, planHamali } from "./hamaliCostMath";

describe("planHamali", () => {
  it("matches the per-bag sample on the hamali sheet", () => {
    const plan = planHamali();

    expect(plan.bags).toBe(830);
    expect(plan.tonnes).toBe(41.5);
    expect(plan.trucks).toBe(3);
    expect(plan.dayBag).toBe(4980);
    expect(plan.dayTonne).toBe(7470);
    expect(plan.dayTruck).toBe(7500);
    expect(plan.day).toBe(4980);
    expect(plan.perBag).toBe(6);
    expect(plan.month).toBe(129480);
    expect(plan.bagsMonth).toBe(21580);
    expect(plan.cheapestLabel).toBe("Per bag");
    expect(plan.savingMonth).toBe(0);
    expect(plan.compare.find((row) => row.id === "tonne").month).toBe(194220);
    expect(plan.compare.find((row) => row.id === "truck").month).toBe(195000);
    expect(plan.compare.find((row) => row.id === "truck").perBag).toBeCloseTo(9.036, 2);
    expect(Math.round(plan.compare.find((row) => row.id === "truck").perTonne)).toBe(181);
  });

  it("costs the truck log at the selected basis", () => {
    const plan = planHamali();
    const first = plan.log[0];

    expect(SAMPLE_TRUCK_LOG).toHaveLength(10);
    expect(plan.trucksLogged).toBe(10);
    expect(plan.logBags).toBe(3860);
    expect(plan.logHamali).toBe(23160);
    expect(plan.hamaliPerTruck).toBe(2316);
    expect(plan.trucksToday).toBe(1);
    expect(first.tonnes).toBe(15);
    expect(first.hamali).toBe(3600);
    expect(first.daysAgo).toBe(6);
    expect(plan.log[7].daysAgo).toBe(2);
    expect(plan.monthAxis).toBe(250000);
    expect(plan.truckAxis).toBe(4000);
  });

  it("counts full trucks in and out separately", () => {
    const plan = planHamali({ ...planHamali().basis, basis: "truck", bagsIn: 400, bagsOut: 1, bagsPerTruck: 400, rateTruck: 2500, rateBagIn: 6, rateBagOut: 6, rateTonne: 180, kgPerBag: 50, workingDays: 26 });
    expect(plan.trucks).toBe(2);
    expect(plan.dayTruck).toBe(5000);
  });
});
