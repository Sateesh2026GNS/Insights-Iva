import { describe, expect, it } from "vitest";
import { buildCustomerPayload, emptyCustomerForm, validateCustomerForm } from "./customerFormModel";

describe("customerFormModel", () => {
  it("requires a display name", () => {
    const form = emptyCustomerForm();
    const result = validateCustomerForm(form);
    expect(result.ok).toBe(false);
    expect(result.errors.display_name).toBeTruthy();
  });

  it("builds API payload from form state", () => {
    const form = {
      ...emptyCustomerForm(),
      display_name: "Acme Traders",
      mobile: "9876543210",
      email: "sales@acme.test",
      gstin: "27AAAAA0000A1Z5",
      billing: { ...emptyCustomerForm().billing, street1: "Main Road", city: "Mumbai", state: "Maharashtra" },
    };
    const payload = buildCustomerPayload(form, { tenantId: 1 });
    expect(payload.name).toBe("Acme Traders");
    expect(payload.phone).toBe("9876543210");
    expect(payload.party_other_details.party_type).toBe("Buyer");
  });
});
