import { describe, expect, it } from "vitest";
import { currentFiscalYearLabel, fiscalYearToYear, formatKpiValue } from "./analyticsMasterData";

describe("formatKpiValue", () => {
  it("formats currency and percent", () => {
    expect(formatKpiValue({ value: 1200, format: "currency" })).toBe("₹1,200");
    expect(formatKpiValue({ value: 86.5, format: "percent" })).toBe("86.5%");
  });

  it("keeps non-numeric strings such as machine counts", () => {
    expect(formatKpiValue({ value: "3/10" })).toBe("3/10");
  });

  it("returns an em dash for empty values", () => {
    expect(formatKpiValue(null)).toBe("—");
    expect(formatKpiValue({ value: "" })).toBe("—");
  });
});

describe("fiscalYearToYear", () => {
  it("reads the Indian FY start year", () => {
    expect(fiscalYearToYear("2026-27")).toBe(2026);
    expect(fiscalYearToYear("")).toBeUndefined();
  });
});

describe("currentFiscalYearLabel", () => {
  it("uses April as the Indian FY start", () => {
    expect(currentFiscalYearLabel(new Date(2026, 9, 14))).toBe("2026-27");
    expect(currentFiscalYearLabel(new Date(2026, 2, 31))).toBe("2025-26");
  });
});
