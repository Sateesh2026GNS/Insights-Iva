import { describe, expect, it } from "vitest";

import { DEFAULT_QUOTATION, planStorageQuotation } from "./storageQuotationMath";

describe("planStorageQuotation", () => {
  it("matches the Om Agro Foods sample", () => {
    const plan = planStorageQuotation();

    expect(plan.quoteNo).toBe("SGW/2026-27/0057");
    expect(plan.rentMonth).toBe(16000);
    expect(plan.charges[0].amount).toBe(48000);
    expect(plan.charges[1].amount).toBe(12000);
    expect(plan.charges[2].amount).toBe(12000);
    expect(plan.charges[3].rate).toBe(1450);
    expect(plan.charges[3].amount).toBe(4350);
    expect(plan.charges[4].amount).toBe(1500);
    expect(plan.linesTotal).toBe(77850);
    expect(plan.afterDiscount).toBe(75850);
    expect(plan.gst).toBe(0);
    expect(plan.total).toBe(75850);
    expect(plan.allIn).toBeCloseTo(12.6417, 3);
    expect(plan.validTill).toBe("03-Nov-2026");
    expect(plan.words).toBe("Rupees Seventy Five Thousand Eight Hundred Fifty Only");
    expect(plan.rentYear).toBe(612000);
    expect(plan.roomBelowLimit).toBe(1388000);
    expect(plan.gstCheck).toBe("Below limit");
    expect(plan.ownLines).toBe(1);
  });

  it("charges GST only when the warehouse is registered", () => {
    const plan = planStorageQuotation({ ...DEFAULT_QUOTATION, gstRegistered: "Yes" });
    expect(plan.gst).toBe(13653);
    expect(plan.total).toBe(89503);
  });

  it("switches rent onto square feet without changing bag handling", () => {
    const plan = planStorageQuotation({ ...DEFAULT_QUOTATION, basis: "sqft" });
    expect(plan.rentMonth).toBe(9800);
    expect(plan.charges[0].amount).toBe(29400);
    expect(plan.charges[1].amount).toBe(12000);
  });
});
