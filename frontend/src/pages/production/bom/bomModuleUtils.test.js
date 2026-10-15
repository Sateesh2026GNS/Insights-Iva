import { describe, expect, it } from "vitest";

import {
  userCanEditBom,
  userCanViewBom,
  userCanViewBomCost,
} from "../../../config/permissions";
import { mapValidationErrorsToFields } from "../../../utils/apiError";
import { bomCostIncomplete, bomCostTotal, grossComponentQuantity } from "./bomModuleUtils";

describe("bomModuleUtils", () => {
  it("computes 1L PET gross quantities", () => {
    expect(grossComponentQuantity(1000, 2)).toBe(1020);
    expect(grossComponentQuantity(1000, 1)).toBe(1010);
    expect(grossComponentQuantity(1000, 3)).toBe(1030);
    expect(grossComponentQuantity(4, 5)).toBe(4.2);
    expect(grossComponentQuantity(40, 0)).toBe(40);
  });

  it("flags incomplete cost when price missing and does not treat it as zero", () => {
    const components = [
      { line_cost: 100, missing_price: false },
      { line_cost: null, missing_price: true },
    ];
    expect(bomCostIncomplete(components)).toBe(true);
    const { total, incomplete } = bomCostTotal(components);
    expect(incomplete).toBe(true);
    expect(total).toBe(100);
  });
});

describe("BOM validation field mapping", () => {
  it("maps dict 422 details to field errors", () => {
    const err = { response: { data: { detail: { product_id: "BOM product must be a finished good." } } } };
    expect(mapValidationErrorsToFields(err).product_id).toMatch(/finished good/i);
  });
});

describe("BOM permission-based buttons", () => {
  it("hides edit and cost for Store Manager", () => {
    const store = { role: "Store Manager", roles: ["Store Manager"] };
    expect(userCanViewBom(store)).toBe(true);
    expect(userCanEditBom(store)).toBe(false);
    expect(userCanViewBomCost(store)).toBe(false);
  });

  it("shows cost for Accountant but not edit", () => {
    const acct = { role: "Accountant", roles: ["Accountant"] };
    expect(userCanViewBom(acct)).toBe(true);
    expect(userCanEditBom(acct)).toBe(false);
    expect(userCanViewBomCost(acct)).toBe(true);
  });

  it("gives Admin full access", () => {
    const admin = { role: "Admin", roles: ["Admin"] };
    expect(userCanViewBom(admin)).toBe(true);
    expect(userCanEditBom(admin)).toBe(true);
    expect(userCanViewBomCost(admin)).toBe(true);
  });

  it("hides BOM from Operator and Sales Manager", () => {
    expect(userCanViewBom({ role: "Operator", roles: ["Operator"] })).toBe(false);
    expect(userCanViewBom({ role: "Sales Manager", roles: ["Sales Manager"] })).toBe(false);
  });
});
