import { describe, expect, it } from "vitest";

import { customerRecordFromApiResponse } from "./partySavedCustomer";

describe("customerRecordFromApiResponse", () => {
  it("returns null without API id", () => {
    expect(customerRecordFromApiResponse({ name: "Acme" }, { name: "Acme" }, {}, null)).toBeNull();
  });

  it("returns enriched customer with id for parent form selection", () => {
    const row = customerRecordFromApiResponse(
      { id: 42, name: "Acme Tools", gstin: null, phone: "9876543210" },
      { name: "Acme Tools", phone: "9876543210" },
      { city: "Mumbai", state: "Maharashtra" },
      null
    );
    expect(row?.id).toBe(42);
    expect(row?.company).toBe("Acme Tools");
  });
});
