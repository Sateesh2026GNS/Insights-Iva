import { describe, expect, it } from "vitest";

import {
  adminDashboardKpiIcon,
  adminDashboardKpiTone,
  ADMIN_DASHBOARD_KPI_TONES,
} from "./adminDashboardToolkit";

describe("adminDashboardToolkit", () => {
  it("cycles KPI tones like Department Operating Plan", () => {
    expect(ADMIN_DASHBOARD_KPI_TONES).toHaveLength(6);
    expect(adminDashboardKpiTone(0)).toBe("blue");
    expect(adminDashboardKpiTone(6)).toBe("blue");
  });

  it("derives compact KPI icons from card metadata", () => {
    expect(adminDashboardKpiIcon({ id: "total-orders" })).toBe("T");
    expect(adminDashboardKpiIcon({ title: "Pending" })).toBe("P");
  });
});
