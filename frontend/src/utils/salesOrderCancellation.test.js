import { describe, expect, it } from "vitest";

import {
  canShowCancelSalesOrderAction,
  isSalesOrderCancelled,
  userCanCancelSalesOrder,
} from "./salesOrderCancellation";

describe("salesOrderCancellation", () => {
  it("detects cancelled orders", () => {
    expect(isSalesOrderCancelled({ status: "cancelled" })).toBe(true);
    expect(isSalesOrderCancelled({ workflow_status: "CANCELLED" })).toBe(true);
    expect(isSalesOrderCancelled({ status: "confirmed" })).toBe(false);
  });

  it("allows Sales Manager and Admin to cancel", () => {
    expect(userCanCancelSalesOrder({ role: "Sales Manager" })).toBe(true);
    expect(userCanCancelSalesOrder({ role: "Admin" })).toBe(true);
    expect(userCanCancelSalesOrder({ role: "Operator" })).toBe(false);
  });

  it("hides cancel action for cancelled or shipped orders", () => {
    const manager = { role: "Sales Manager" };
    expect(
      canShowCancelSalesOrderAction({ status: "confirmed", workflow_status: "MATERIAL_CHECK_PENDING" }, manager)
    ).toBe(true);
    expect(canShowCancelSalesOrderAction({ status: "cancelled" }, manager)).toBe(false);
    expect(canShowCancelSalesOrderAction({ status: "confirmed", shipped: true }, manager)).toBe(false);
  });
});
