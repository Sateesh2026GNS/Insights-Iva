import { describe, expect, it } from "vitest";

import { DEFAULT_TRUCK_LOAD, planTruckLoad } from "./truckLoadMath";

describe("planTruckLoad", () => {
  it("matches the wheat load on a 16 tonne truck", () => {
    const plan = planTruckLoad();
    const truck = plan.selected;

    expect(truck.name).toBe("Truck 16 t (10 wheel)");
    expect(truck.byWeight).toBe(320);
    expect(truck.byVolume).toBe(576);
    expect(truck.perTruck).toBe(320);
    expect(truck.limitedBy).toBe("Weight");
    expect(truck.trucks).toBe(4);
    expect(truck.loadWeight).toBeCloseTo(93.75, 2);
    expect(truck.loadVolume).toBeCloseTo(52, 2);
    expect(truck.freightTotal).toBe(48000);
    expect(truck.freightPerUnit).toBe(40);
    expect(truck.freightPerTonne).toBe(800);
    expect(truck.lastTruck).toBe(240);
    expect(plan.cheapest.name).toBe("Truck 21 t (12 wheel)");
    expect(plan.cheapest.freightPerUnit).toBe(38.75);
    expect(plan.freightAxis).toBe(80);
    expect(plan.loadAxis).toBe(120);
  });

  it("compares the other sample truck types for the same 1,200 bags", () => {
    const plan = planTruckLoad();
    const byName = Object.fromEntries(plan.rows.map((row) => [row.name, row]));

    expect(byName["Pickup 1.5 t"].trucks).toBe(40);
    expect(byName["Pickup 1.5 t"].freightPerUnit).toBe(60);
    expect(Math.round(byName["Pickup 1.5 t"].loadVolume)).toBe(26);
    expect(byName["LCV 4 t"].perTruck).toBe(80);
    expect(byName["LCV 4 t"].freightTotal).toBe(52500);
    expect(byName["Truck 9 t (6 wheel)"].trucks).toBe(7);
    expect(Math.round(byName["Truck 9 t (6 wheel)"].loadWeight)).toBe(95);
    expect(Math.round(byName["Truck 21 t (12 wheel)"].loadVolume)).toBe(58);
    expect(byName["Truck 21 t (12 wheel)"].freightTotal).toBe(46500);
    expect(byName["Container 32 ft"].perTruck).toBe(300);
    expect(Math.round(byName["Container 32 ft"].loadVolume)).toBe(34);
  });

  it("cuts units per truck when the load limit is below 100%", () => {
    const plan = planTruckLoad({ ...DEFAULT_TRUCK_LOAD, loadLimit: 50 });
    expect(plan.selected.byWeight).toBe(160);
    expect(plan.selected.perTruck).toBe(160);
    expect(plan.selected.trucks).toBe(8);
  });
});
