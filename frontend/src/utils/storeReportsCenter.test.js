import { describe, expect, it } from "vitest";

import {
  REPORT_CENTER_CATEGORIES,
  formatInr,
  reportMatchesZohoCategory,
  zohoCategoryForReport,
} from "./storeReportsCenter";

describe("storeReportsCenter", () => {
  it("lists nine category folders", () => {
    expect(REPORT_CENTER_CATEGORIES).toHaveLength(9);
  });

  it("matches category filters", () => {
    expect(reportMatchesZohoCategory({ category: "Sales" }, "Sales")).toBe(true);
    expect(zohoCategoryForReport({ category: "Inventory" })).toBe("Inventory");
  });

  it("formats INR with Indian grouping", () => {
    expect(formatInr(1234567.8)).toContain("12,34,567");
  });
});
