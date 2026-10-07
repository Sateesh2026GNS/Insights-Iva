import { describe, expect, it } from "vitest";

import {
  clearQuotationBuyerSelection,
  quotationBuyerActionVisibility,
} from "./quotationBuyerSectionUi";

describe("quotationBuyerSectionUi", () => {
  it("shows Select and Add New when no buyer", () => {
    expect(
      quotationBuyerActionVisibility({ hasBuyer: false, canEditBuyer: true })
    ).toEqual({
      showSelectBuyer: true,
      showAddNewBuyer: true,
      showEditBuyer: false,
      showRemoveBuyer: false,
      showEditBuyerLink: false,
    });
  });

  it("shows Select, Add New, Remove and edit link when buyer selected", () => {
    expect(
      quotationBuyerActionVisibility({ hasBuyer: true, canEditBuyer: true })
    ).toEqual({
      showSelectBuyer: true,
      showAddNewBuyer: true,
      showEditBuyer: false,
      showRemoveBuyer: true,
      showEditBuyerLink: true,
    });
  });

  it("hides edit link when user cannot edit customers", () => {
    expect(
      quotationBuyerActionVisibility({ hasBuyer: true, canEditBuyer: false })
    ).toMatchObject({
      showEditBuyerLink: false,
      showRemoveBuyer: true,
    });
  });

  it("clearQuotationBuyerSelection clears customer_id only when consignee differs", () => {
    const form = {
      customer_id: "42",
      notes: "keep",
      consignee_name: "Ship To",
    };
    const next = clearQuotationBuyerSelection(form, false);
    expect(next.customer_id).toBe("");
    expect(next.notes).toBe("keep");
    expect(next.consignee_name).toBe("Ship To");
  });

  it("clearQuotationBuyerSelection clears synced consignee when same as buyer", () => {
    const form = {
      customer_id: "42",
      consignee_name: "Acme",
      consignee_address1: "Line 1",
    };
    const next = clearQuotationBuyerSelection(form, true);
    expect(next.customer_id).toBe("");
    expect(next.consignee_name).toBe("");
    expect(next.consignee_address1).toBe("");
  });
});
