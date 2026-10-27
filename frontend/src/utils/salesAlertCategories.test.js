import { describe, expect, it } from "vitest";

import { salesAlertCategory, salesAlertSummary } from "./salesAlertCategories";

describe("sales alert categories", () => {
  it("maps only stored alert types and follow-up leads", () => {
    expect(salesAlertCategory({ alert_type: "order_delay" })?.id).toBe("order_delay");
    expect(salesAlertCategory({ alert_type: "low_stock" })?.id).toBe("inventory");
    expect(salesAlertCategory({ alert_type: "payment_overdue" })?.id).toBe("payment");
    expect(salesAlertCategory({ alert_type: "invoice_generated" })).toBeNull();
    expect(salesAlertCategory({ alert_type: "dispatch_completed" })).toBeNull();
    expect(
      salesAlertCategory({
        alert_type: "sales_order",
        title: "Follow-up due",
        metadata_json: JSON.stringify({ reference_type: "lead" }),
      })?.id
    ).toBe("follow_up");
  });

  it("counts unread, critical, order delay, and resolved from the same rows", () => {
    const summary = salesAlertSummary([
      { alert_type: "order_delay", severity: "critical", status: "active", is_read: false },
      { alert_type: "low_stock", severity: "medium", status: "active", is_read: true },
      { alert_type: "order_delay", severity: "high", status: "resolved", is_read: true },
    ]);
    expect(summary).toEqual({ total: 3, unread: 1, critical: 1, orderDelay: 2, resolved: 1 });
  });
});
