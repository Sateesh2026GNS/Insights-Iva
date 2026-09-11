import { describe, expect, it } from "vitest";
import { filterCustomersByView } from "./customerListViews";

const sample = [
  { id: 1, status: "active", outstanding: 100, pending_payments: 1, gstin: "22AAAAA0000A1Z5" },
  { id: 2, status: "active", outstanding: 0, pending_payments: 0, gstin: "22AAAAA0000A1Z5" },
  { id: 3, status: "inactive", outstanding: 50, pending_payments: 0, gstin: "22BBBBB0000B1Z5" },
];

describe("filterCustomersByView", () => {
  it("returns all customers for the default view", () => {
    expect(filterCustomersByView(sample, "all")).toHaveLength(3);
  });

  it("filters unpaid customers by outstanding balance", () => {
    expect(filterCustomersByView(sample, "unpaid").map((c) => c.id)).toEqual([1, 3]);
  });

  it("finds duplicate customers by gstin", () => {
    expect(filterCustomersByView(sample, "duplicate").map((c) => c.id)).toEqual([1, 2]);
  });
});
