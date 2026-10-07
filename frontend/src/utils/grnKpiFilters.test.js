import { describe, expect, it } from "vitest";
import { countGrnKpi, grnMatchesKpi } from "./grnKpiFilters";

const today = "2026-04-07";

const rows = [
  { id: 1, receipt_date: today, status: "received", qc_status: "pass" },
  { id: 2, receipt_date: "2026-04-01", status: "pending_qc", qc_status: "pending" },
  { id: 3, receipt_date: today, status: "rejected", qc_status: "rejected" },
];

describe("grnKpiFilters", () => {
  it("matches backend received count", () => {
    expect(countGrnKpi(rows, "received", today)).toBe(1);
    expect(grnMatchesKpi(rows[0], "received", today)).toBe(true);
    expect(grnMatchesKpi(rows[1], "received", today)).toBe(false);
  });

  it("matches pending QC", () => {
    expect(countGrnKpi(rows, "pending_qc", today)).toBe(1);
  });
});
