import { describe, expect, it } from "vitest";

import { getToolkitConfig } from "./manufacturingToolkitConfigs";
import { resolveToolkitConfig } from "./manufacturingToolkitLiveMerge";

describe("manufacturingToolkitLiveMerge", () => {
  it("quality_defect replaces reference rows with API defects", () => {
    const config = resolveToolkitConfig("quality_defect", {
      defects: [
        {
          id: 1,
          defect_code: "DEF-API-1",
          description: "Surface finish",
          product_name: "Live Product",
          department: "Line A",
          severity: "major",
          status: "open",
          quantity_affected: 3,
        },
      ],
      defectSummary: { total_defects: 1, open: 1, resolved: 0, critical: 0 },
      orders: [{ produced_quantity: 100 }],
    });
    expect(config.kpis.find((k) => k.label === "Total Defects")?.value).toBe("1");
    const table = config.layout.find((s) => s.type === "row")?.children?.find((c) => c.type === "table")
      || config.layout.find((s) => s.type === "table");
    const rows = table?.rows || config.layout.flatMap((s) => (s.type === "table" ? s.rows : []));
    const flatRows = rows.length
      ? rows
      : config.layout
          .flatMap((s) => s.children || [])
          .find((c) => c.type === "table")?.rows;
    expect(flatRows?.[0]?.product).toBe("Live Product");
    expect(flatRows?.[0]?.id).toBe("DEF-API-1");
    expect(config.kpis.find((k) => k.label === "Defect Rate")?.value).toBe("3");
  });

  it("output_downtime uses maintenance summary for downtime hours", () => {
    const base = getToolkitConfig("output_downtime");
    const config = resolveToolkitConfig("output_downtime", {
      orders: [{ planned_quantity: 100, produced_quantity: 80 }],
      summary: { completed_orders: 1 },
      breakdownSummary: { total_downtime_hours: 12.5 },
    });
    expect(config.kpis.find((k) => k.label === "Total Downtime")?.value).toBe("12.5");
    expect(base.kpis.find((k) => k.label === "Planned Output")?.value).not.toBe(
      config.kpis.find((k) => k.label === "Planned Output")?.value
    );
  });

  it("capacity_planning uses machine and allocation context", () => {
    const config = resolveToolkitConfig("capacity_planning", {
      machines: [
        { id: 1, name: "CNC-1", line: "CNC", utilization_pct: 90, planned_hours: 8 },
        { id: 2, name: "CNC-2", line: "CNC", utilization_pct: 88, planned_hours: 8 },
      ],
      allocationSummary: { total_machines: 2, utilization_pct: 89 },
      allocationRows: [{ machine_id: 1, machine_name: "CNC-1", product_name: "Bracket" }],
    });
    expect(config.kpis.find((k) => k.label === "Utilization")?.value).toBeTruthy();
    const table = config.layout
      .flatMap((s) => (s.type === "row" ? s.children : [s]))
      .find((c) => c.type === "table");
    expect(table?.rows?.length).toBeGreaterThan(0);
    expect(table.rows[0].line).toBe("CNC");
  });
});
