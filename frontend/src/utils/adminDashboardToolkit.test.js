import { describe, expect, it } from "vitest";

import {
  adminDashboardKpiIcon,
  adminDashboardKpiTone,
  ADMIN_DASHBOARD_KPI_TONES,
  buildAdminDashboardExportRows,
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

  it("builds admin export rows from visible KPI and report sections", () => {
    const rows = buildAdminDashboardExportRows({
      kpis: [{ title: "Total Orders", value: 4 }],
      orders: { total: 4, inProgress: 1, completed: 2, onHold: 1, progress: 50 },
      summary: [{ label: "Man Power", value: "7" }],
      pipeline: { pending: 0, planned: 1, in_production: 2, qc: 0, completed: 3 },
      alerts: [],
    });

    expect(rows).toEqual(
      expect.arrayContaining([
        { metric: "Total Orders", value: "4" },
        { metric: "Orders — In progress", value: "1" },
        { metric: "Man Power", value: "7" },
        { metric: "Pipeline — In production", value: "2" },
      ])
    );
  });
});
