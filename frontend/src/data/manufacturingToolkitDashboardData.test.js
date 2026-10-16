import { describe, expect, it } from "vitest";

import { toolkitApiToOverlay } from "./manufacturingToolkitDashboardData";

describe("toolkitApiToOverlay", () => {
  it("maps API payload and uses em dash for null KPI values", () => {
    const overlay = toolkitApiToOverlay({
      toolkit_id: "issue_log",
      data_available: true,
      kpis: [{ key: "open", label: "Open", value: null, tone: "red" }],
      table_rows: [{ id: "ISS-1", title: "Test" }],
      charts: { priority_bar: [{ name: "high", v: 1 }] },
    });
    expect(overlay.loaded).toBe(true);
    expect(overlay.kpis[0].value).toBe("—");
    expect(overlay.table_rows).toHaveLength(1);
  });
});
