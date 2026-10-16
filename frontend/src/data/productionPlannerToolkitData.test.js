import { describe, expect, it } from "vitest";
import {
  dailyRowMetrics,
  emptyPlannerModel,
  plannerApiToModel,
} from "./productionPlannerToolkitData";

describe("productionPlannerToolkitData", () => {
  it("emptyPlannerModel has zero KPIs and no reference mock rows", () => {
    const m = emptyPlannerModel();
    expect(m.dailyRows).toEqual([]);
    expect(m.weeklyRows).toEqual([]);
    expect(m.kpis.find((k) => k.key === "today_plan")?.value).toBe("0");
  });

  it("plannerApiToModel maps API snake_case to UI model", () => {
    const m = plannerApiToModel({
      kpis: [{ key: "today_plan", label: "Today's Plan", value: "100", unit: "Units" }],
      daily_rows: [
        {
          sno: 1,
          product: "Widget",
          code: "W-1",
          machine: "MC-1",
          shift: "A",
          planned: 100,
          actual: 90,
          variance: -10,
          achievement: 90,
          status: "slight_delay",
        },
      ],
      week_label: "01-Jun-2026 to 07-Jun-2026",
      week_days: ["Mon"],
      weekly_rows: [{ product: "Widget", days: [100], total: 100 }],
      machines: [{ machine: "MC-1", line: "L1", shift_a: "Widget", shift_b: "—", shift_c: "—", status: "running" }],
      dispatch_rows: [
        { customer: "Acme", product: "Widget", qty: 50, dispatch_date: "16-Jun-2026", status: "pending" },
      ],
      daily_chart: [{ day: "Mon", planned: 100, actual: 90 }],
      product_mix: [{ name: "Widget", value: 90, pct: 100 }],
      insights: ["ok"],
      actions: ["act"],
    });
    expect(m.dailyRows[0].product).toBe("Widget");
    expect(m.machines[0].shiftA).toBe("Widget");
    expect(m.dispatch[0].date).toBe("16-Jun-2026");
    expect(m.kpis[0].tone).toBe("blue");
  });

  it("plannerApiToModel returns empty model for null payload", () => {
    const m = plannerApiToModel(null);
    expect(m.dailyRows).toHaveLength(0);
  });

  it("dailyRowMetrics handles zero planned quantity", () => {
    const m = dailyRowMetrics({ planned: 0, actual: 5 });
    expect(m.achievement).toBe(0);
    expect(m.variance).toBe(5);
  });
});
