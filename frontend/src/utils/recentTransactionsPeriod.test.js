import { describe, expect, it } from "vitest";

import {
  PERIOD_CUSTOM,
  PERIOD_RECENT,
  buildRecentTransactionsPeriodOptions,
  formatCustomPeriodRangeLabel,
  resolveRecentTransactionsPeriod,
  validateCustomPeriodRange,
} from "./recentTransactionsPeriod";

describe("recentTransactionsPeriod", () => {
  const now = new Date(2026, 8, 25);

  it("builds expected preset labels including Custom Date", () => {
    const options = buildRecentTransactionsPeriodOptions(now);
    const labels = options.map((o) => o.label);
    expect(labels[0]).toBe("Recent Transactions");
    expect(labels).toContain("September 2026");
    expect(labels).toContain("August 2026");
    expect(labels).toContain("Current Financial Year");
    expect(labels).toContain("Previous Financial Year");
    expect(labels).toContain("Custom Date");
  });

  it("resolves custom range when applied", () => {
    const options = buildRecentTransactionsPeriodOptions(now);
    const range = resolveRecentTransactionsPeriod(PERIOD_CUSTOM, options, {
      from: "2026-09-01",
      to: "2026-09-25",
    });
    expect(range).toEqual({ from: "2026-09-01", to: "2026-09-25" });
  });

  it("formats custom range for dropdown display", () => {
    expect(formatCustomPeriodRangeLabel("2026-09-01", "2026-09-25")).toMatch(
      /1 Sep(t)? 2026 — 25 Sep(t)? 2026/
    );
  });

  it("validates required from/to and order", () => {
    expect(validateCustomPeriodRange("", "2026-09-25").valid).toBe(false);
    expect(validateCustomPeriodRange("2026-09-25", "2026-09-01").valid).toBe(false);
    expect(validateCustomPeriodRange("2026-09-01", "2026-09-25").valid).toBe(true);
  });

  it("resolves recent transactions as rolling window", () => {
    const options = buildRecentTransactionsPeriodOptions(now);
    const { from, to } = resolveRecentTransactionsPeriod(PERIOD_RECENT, options);
    expect(to).toBe("2026-09-25");
    expect(from).toBe("2026-08-26");
  });
});
