import { describe, expect, it } from "vitest";

import {
  buildSalesDashboardPeriodPresets,
  defaultSalesDashboardRange,
  findPresetByRange,
  formatSalesDashboardPeriodMeta,
  formatSalesPeriodRangeLabel,
  salesDashboardRangeParams,
  startOfWeekSunday,
} from "./salesDashboardPeriod";
import { toIsoDate, startOfMonth } from "./dateUtils";

describe("salesDashboardPeriod", () => {
  const now = new Date(2026, 8, 23); // 23 Sep 2026 (Wednesday)

  it("defaults to this month through today", () => {
    const { from, to } = defaultSalesDashboardRange(now);
    expect(from).toBe(toIsoDate(startOfMonth(now)));
    expect(to).toBe("2026-09-23");
  });

  it("includes all required presets in order", () => {
    const presets = buildSalesDashboardPeriodPresets(now);
    expect(presets.map((p) => p.id)).toEqual([
      "today",
      "yesterday",
      "this_week",
      "last_week",
      "this_month",
      "last_month",
      "this_quarter",
      "last_quarter",
      "this_year",
    ]);
  });

  it("builds this month preset matching default range", () => {
    const presets = buildSalesDashboardPeriodPresets(now);
    const thisMonth = presets.find((p) => p.id === "this_month");
    expect(thisMonth?.from).toBe("2026-09-01");
    expect(thisMonth?.to).toBe("2026-09-23");
  });

  it("builds yesterday and last week with calendar week boundaries", () => {
    const presets = buildSalesDashboardPeriodPresets(now);
    expect(presets.find((p) => p.id === "yesterday")).toEqual({
      id: "yesterday",
      label: "Yesterday",
      from: "2026-09-22",
      to: "2026-09-22",
    });
    const lastWeek = presets.find((p) => p.id === "last_week");
    expect(lastWeek?.from).toBe("2026-09-13");
    expect(lastWeek?.to).toBe("2026-09-19");
    const thisWeek = presets.find((p) => p.id === "this_week");
    expect(thisWeek?.from).toBe(toIsoDate(startOfWeekSunday(now)));
    expect(thisWeek?.to).toBe("2026-09-23");
  });

  it("rejects invalid ranges for API params", () => {
    expect(salesDashboardRangeParams("2026-09-23", "2026-09-01")).toBeNull();
    expect(salesDashboardRangeParams("2026-09-01", "2026-09-23")).toEqual({
      from_date: "2026-09-01",
      to_date: "2026-09-23",
    });
  });

  it("detects preset by range", () => {
    const presets = buildSalesDashboardPeriodPresets(now);
    expect(findPresetByRange(presets, "2026-09-01", "2026-09-23")).toBe("this_month");
    expect(findPresetByRange(presets, "2026-08-01", "2026-08-31")).toBe("last_month");
    expect(findPresetByRange(presets, "2026-08-15", "2026-08-20")).toBe("custom");
  });

  it("formats KPI meta from preset id or custom range", () => {
    const presets = buildSalesDashboardPeriodPresets(now);
    expect(formatSalesDashboardPeriodMeta("last_month", presets, "2026-08-01", "2026-08-31")).toBe(
      "Last Month"
    );
    expect(formatSalesDashboardPeriodMeta("custom", presets, "2026-09-01", "2026-09-23")).toBe(
      formatSalesPeriodRangeLabel("2026-09-01", "2026-09-23")
    );
  });
});
