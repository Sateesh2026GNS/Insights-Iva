import { describe, expect, it } from "vitest";

import {
  STORE_DASHBOARD_KPI_TONES,
  storeDashboardKpiIcon,
  storeDashboardKpiTone,
} from "./storeDashboardToolkit";

describe("storeDashboardToolkit", () => {
  it("starts KPI tones like Capacity Planning toolkit cards", () => {
    expect(STORE_DASHBOARD_KPI_TONES.slice(0, 5)).toEqual(["blue", "green", "orange", "purple", "red"]);
    expect(storeDashboardKpiTone(0)).toBe("blue");
    expect(storeDashboardKpiTone(8)).toBe("blue");
  });

  it("uses compact Capacity Planning style KPI icons", () => {
    expect(storeDashboardKpiIcon("pendingJobCards")).toBe("JC");
    expect(storeDashboardKpiIcon("stockIn")).toBe("IN");
    expect(storeDashboardKpiIcon("unknown")).toBe("•");
  });
});
