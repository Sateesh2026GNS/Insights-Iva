import { describe, expect, it } from "vitest";

import {
  SALES_DASHBOARD_KPI_TONES,
  salesDashboardKpiIcon,
  salesDashboardKpiTone,
} from "./salesDashboardToolkit";

describe("salesDashboardToolkit", () => {
  it("cycles KPI tones like Team Capacity toolkit cards", () => {
    expect(SALES_DASHBOARD_KPI_TONES[0]).toBe("blue");
    expect(SALES_DASHBOARD_KPI_TONES[5]).toBe("teal");
    expect(salesDashboardKpiTone(0)).toBe("blue");
    expect(salesDashboardKpiTone(8)).toBe("blue");
  });

  it("uses compact Team Capacity style KPI icons", () => {
    expect(salesDashboardKpiIcon("totalOrders")).toBe("SO");
    expect(salesDashboardKpiIcon("conversionRate")).toBe("%");
    expect(salesDashboardKpiIcon("unknown")).toBe("•");
  });
});
