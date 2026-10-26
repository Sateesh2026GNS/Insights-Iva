import { describe, expect, it } from "vitest";

import { addDays, buildQuotationPayload, quoteTotals } from "./jobOrderQuotation";

describe("job order quotation totals", () => {
  it("adds freight before GST and keeps the GST on the combined taxable value", () => {
    const totals = quoteTotals({
      lines: [
        { description: "Product A - Steel Bracket", qty: 20000, unit: "pcs", rate: 114 },
        { description: "Product B - Mounting Plate", qty: 5000, unit: "pcs", rate: 46 },
        { description: "Product C - Hinge Set", qty: 8000, unit: "set", rate: 28 },
        { description: "Tooling and die charge (one time)", qty: 1, unit: "lot", rate: 35000 },
        { description: "   ", qty: 5, unit: "pcs", rate: 10 },
      ],
      freight: 3500,
      gstPct: 18,
      roundOff: 0,
    });
    expect(totals.itemCount).toBe(4);
    expect(totals.itemTotal).toBe(2769000);
    expect(totals.taxable).toBe(2772500);
    expect(totals.gst).toBe(499050);
    expect(totals.total).toBe(3271550);
  });

  it("leaves GST blank when the rate is missing and stores freight inside the quotation payload", () => {
    const totals = quoteTotals({
      lines: [{ description: "Bracket", qty: 2, unit: "pcs", rate: 100 }],
      freight: 0,
      gstPct: "",
      roundOff: -0.4,
    });
    expect(totals.gst).toBe(0);
    expect(totals.total).toBe(199.6);
    const payload = buildQuotationPayload({
      tenantId: 3,
      customerName: "Harbor",
      quoteDate: "2026-10-04",
      validUntil: addDays("2026-10-04", 15),
      totals,
      deliveryTerms: "Within 21 days of the PO",
      paymentTerms: "50% advance",
    });
    expect(payload.quote_number).toBeUndefined();
    expect(payload.valid_until).toBe("2026-10-19");
    expect(payload.total_amount).toBe(199.6);
    expect(payload.meta_json.items).toHaveLength(1);
    expect(payload.meta_json.items[0].gst_amount).toBe(0);
    expect(payload.meta_json.transportation.delivery_terms).toBe("Within 21 days of the PO");
  });
});
