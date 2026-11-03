import { describe, expect, it } from "vitest";

import { computeOperatorJobCardKpis } from "./operatorJobCardQueueKpis";

describe("computeOperatorJobCardKpis", () => {
  it("counts loaded job cards without inventing a progress percent", () => {
    const kpis = computeOperatorJobCardKpis([
      { workflow_status: "PRODUCTION_ASSIGNED" },
      { workflow_status: "PRODUCTION_IN_PROGRESS" },
      { workflow_status: "QUALITY_CHECK_PENDING" },
      { workflow_status: "PRODUCTION_COMPLETED" },
      { workflow_status: "" },
    ]);
    const byLabel = Object.fromEntries(kpis.map((kpi) => [kpi.label, kpi.value]));
    expect(byLabel["Total Job Cards"]).toBe("5");
    expect(byLabel.Assigned).toBe("1");
    expect(byLabel["In Progress"]).toBe("1");
    expect(byLabel["Quality Check"]).toBe("1");
    expect(byLabel.Completed).toBe("1");
    expect(byLabel["Not Started"]).toBe("1");
    expect(kpis.some((kpi) => kpi.unit === "%")).toBe(false);
  });
});
