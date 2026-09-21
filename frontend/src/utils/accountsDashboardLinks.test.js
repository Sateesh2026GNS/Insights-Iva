import { describe, expect, it } from "vitest";

import {
  invoicesLink,
  payablesLink,
  paymentsLink,
  receivablesLink,
} from "./accountsDashboardLinks";

describe("accountsDashboardLinks", () => {
  it("builds receivables overdue link", () => {
    expect(receivablesLink("overdue")).toBe("/finance/accounts-receivable?focus=overdue");
  });

  it("builds payments pending link", () => {
    expect(paymentsLink("pending")).toBe("/finance/payment-tracking?focus=pending");
  });

  it("builds invoice payment filter link", () => {
    expect(invoicesLink({ payment: "unpaid" })).toBe("/sales/invoices?payment=unpaid");
  });

  it("builds payables focus link", () => {
    expect(payablesLink("overdue")).toBe("/accounts/accounts-payable?focus=overdue");
  });
});
