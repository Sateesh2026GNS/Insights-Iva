import { describe, expect, it } from "vitest";

import { canConvertQuotationToSalesOrder } from "./quotationWorkflow";

describe("canConvertQuotationToSalesOrder", () => {
  it("allows accepted quotations that are not yet converted", () => {
    expect(canConvertQuotationToSalesOrder({ status: "accepted", converted_to_so: false })).toBe(true);
  });

  it("blocks when already converted", () => {
    expect(canConvertQuotationToSalesOrder({ status: "accepted", converted_to_so: true })).toBe(false);
  });

  it("blocks draft quotations", () => {
    expect(canConvertQuotationToSalesOrder({ status: "draft", converted_to_so: false })).toBe(false);
  });
});
