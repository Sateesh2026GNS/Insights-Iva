import { describe, expect, it } from "vitest";
import {
  buildCustomerPayload,
  customerToForm,
  emptyCustomerForm,
  validateCustomerForm,
} from "./customerFormModel";

describe("customerFormModel", () => {
  it("requires a display name", () => {
    const form = emptyCustomerForm();
    const result = validateCustomerForm(form);
    expect(result.ok).toBe(false);
    expect(result.errors.display_name).toBeTruthy();
  });

  it("validates phone numbers format and duplicate numbers", () => {
    const form = {
      ...emptyCustomerForm(),
      display_name: "Acme Corp",
      work_phone: "12345", // invalid Indian number
    };
    let result = validateCustomerForm(form);
    expect(result.ok).toBe(false);
    expect(result.errors.work_phone).toBeTruthy();

    form.work_phone = "9110721034";
    form.mobile = "9110721034"; // duplicate
    result = validateCustomerForm(form);
    expect(result.ok).toBe(false);
    expect(result.errors.mobile).toBe(
      "Alternate phone number must be different from primary phone number"
    );

    form.mobile = "9876543210";
    result = validateCustomerForm(form);
    expect(result.ok).toBe(true);
  });

  it("builds API payload with both primary and alternate phone", () => {
    const form = {
      ...emptyCustomerForm(),
      display_name: "Acme Traders",
      work_phone: "9110721034",
      mobile: "9876543210",
      email: "sales@acme.test",
      gstin: "27AAAAA0000A1Z5",
      billing: {
        ...emptyCustomerForm().billing,
        street1: "Main Road",
        city: "Mumbai",
        state: "Maharashtra",
      },
    };
    const payload = buildCustomerPayload(form, { tenantId: 1 });
    expect(payload.name).toBe("Acme Traders");
    expect(payload.phone).toBe("9110721034");
    expect(payload.party_other_details.party_type).toBe("Buyer");

    const customFields = payload.party_custom_fields;
    expect(customFields.find((f) => f.label === "_work_phone")?.value).toBe(
      "9110721034"
    );
    expect(customFields.find((f) => f.label === "_alternate_phone")?.value).toBe(
      "9876543210"
    );
  });

  it("hydrates customerToForm with work_phone and alternate_phone", () => {
    const customer = {
      name: "Acme Traders",
      phone: "9110721034",
      _party_custom_fields: [
        { label: "_work_phone", value: "9110721034" },
        { label: "_alternate_phone", value: "9876543210" },
      ],
    };
    const form = customerToForm(customer);
    expect(form.display_name).toBe("Acme Traders");
    expect(form.work_phone).toBe("9110721034");
    expect(form.mobile).toBe("9876543210");
  });
});
