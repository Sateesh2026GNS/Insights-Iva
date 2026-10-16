import { describe, expect, it } from "vitest";

import {
  indianFyStartIso,
  isoToDisplayDate,
  parseStoredOpeningBalanceDate,
  unwrapFeatureSettingValue,
} from "./openingBalancesSettings";

describe("openingBalancesSettings", () => {
  it("defaults to 1 April of the current Indian financial year", () => {
    expect(indianFyStartIso(new Date("2026-10-15"))).toBe("2026-04-01");
    expect(indianFyStartIso(new Date("2026-02-01"))).toBe("2025-04-01");
  });

  it("formats ISO dates as dd/MM/yyyy", () => {
    expect(isoToDisplayDate("2026-04-15")).toBe("15/04/2026");
  });

  it("parses stored string or object values", () => {
    expect(parseStoredOpeningBalanceDate("2026-04-15", "2026-04-01")).toBe("2026-04-15");
    expect(parseStoredOpeningBalanceDate({ opening_balance_date: "2026-04-15" }, "2026-04-01")).toBe(
      "2026-04-15"
    );
    expect(parseStoredOpeningBalanceDate(null, "2026-04-01")).toBe("2026-04-01");
  });

  it("unwraps feature-setting envelopes", () => {
    expect(unwrapFeatureSettingValue({ data: { value: "2026-04-15" } })).toBe("2026-04-15");
    expect(unwrapFeatureSettingValue({ data: { success: true, data: { value: "2026-04-15" } } })).toBe(
      "2026-04-15"
    );
  });
});
