import { describe, expect, it } from "vitest";
import {
  applyMaterialRequestFieldFilters,
  filterMaterialRequestsByKpi,
  isMrApproved,
  isMrConverted,
} from "./materialRequestKpi";

describe("materialRequestKpi", () => {
  const rows = [
    { id: 1, approval_status: "pending", status: "pending" },
    { id: 2, approval_status: "approved", status: "approved" },
    { id: 3, approval_status: "approved", status: "converted", converted_to_po: true },
    { id: 4, approval_status: "rejected", status: "rejected" },
  ];

  it("approved excludes converted rows", () => {
    expect(filterMaterialRequestsByKpi(rows, "approved")).toHaveLength(1);
    expect(isMrApproved(rows[1])).toBe(true);
    expect(isMrApproved(rows[2])).toBe(false);
  });

  it("converted matches status or flag", () => {
    expect(filterMaterialRequestsByKpi(rows, "converted")).toHaveLength(1);
    expect(isMrConverted(rows[2])).toBe(true);
  });

  it("combines kpi with department filter", () => {
    const withDept = rows.map((r, i) => ({ ...r, department: i < 2 ? "Store" : "Production" }));
    const filtered = applyMaterialRequestFieldFilters(withDept, {
      kpi: "approved",
      department: "Store",
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe(2);
  });
});
