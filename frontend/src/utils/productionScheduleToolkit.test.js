import { describe, expect, it } from "vitest";

import { SCHEDULE_TOOLKIT_KPIS, formatScheduleKpiValue } from "./productionScheduleToolkit";

describe("productionScheduleToolkit", () => {
  it("defines six Budget Planner–style KPI cards", () => {
    expect(SCHEDULE_TOOLKIT_KPIS).toHaveLength(6);
    expect(SCHEDULE_TOOLKIT_KPIS.map((k) => k.label)).toEqual([
      "Target Quantity",
      "Completed Orders",
      "Pending Orders",
      "Delayed Orders",
      "Utilization",
      "Overall Progress",
    ]);
  });

  it("formats dashboard values for KPI display", () => {
    const dash = {
      production_target: 1200,
      machine_utilization_pct: 77,
      overall_progress_pct: null,
    };
    expect(formatScheduleKpiValue(dash, SCHEDULE_TOOLKIT_KPIS[0])).toBe("1,200");
    expect(formatScheduleKpiValue(dash, SCHEDULE_TOOLKIT_KPIS[4])).toBe("77%");
    expect(formatScheduleKpiValue(dash, SCHEDULE_TOOLKIT_KPIS[5])).toBe("0%");
  });
});
