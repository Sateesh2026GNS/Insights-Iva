import { describe, expect, it } from "vitest";

import {
  OPERATOR_DASHBOARD_KPI_TONES,
  operatorDashboardKpiHref,
  operatorDashboardKpiIcon,
  operatorDashboardKpiTone,
} from "./operatorDashboardToolkit";

describe("operatorDashboardToolkit", () => {
  it("cycles KPI tones in the Team Capacity order", () => {
    expect(OPERATOR_DASHBOARD_KPI_TONES).toEqual(["blue", "green", "orange", "purple", "red", "teal", "yellow"]);
    expect(operatorDashboardKpiTone(0)).toBe("blue");
    expect(operatorDashboardKpiTone(6)).toBe("yellow");
    expect(operatorDashboardKpiTone(7)).toBe("blue");
  });

  it("uses short Team Capacity style icons for operator KPIs", () => {
    expect(operatorDashboardKpiIcon({ id: "my-work-orders" })).toBe("WO");
    expect(operatorDashboardKpiIcon({ id: "quality-checks-pending" })).toBe("QC");
    expect(operatorDashboardKpiIcon({ title: "Total Orders" })).toBe("T");
  });

  it("sends work and machine cards to operator pages and does not link quality", () => {
    expect(operatorDashboardKpiHref({ id: "my-work-orders", link: "/production/work-orders" })).toBe("/my-job-cards");
    expect(operatorDashboardKpiHref({ id: "todays-target", value: "0" })).toBe("/my-job-cards");
    expect(operatorDashboardKpiHref({ id: "assigned-machine", link: "/production/machines" })).toBe("/production/my-machine");
    expect(operatorDashboardKpiHref({ id: "machine-status", link: "/production/my-machine" })).toBe("/production/my-machine");
    expect(operatorDashboardKpiHref({ id: "quality-checks-pending", value: "0", link: "/quality" })).toBeNull();
  });
});
