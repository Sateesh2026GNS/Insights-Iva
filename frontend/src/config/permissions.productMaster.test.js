import { describe, expect, it } from "vitest";

import { userCanWriteProductMaster } from "./permissions";

describe("Masters Products RBAC", () => {
  it("Accountant cannot write products or pricing", () => {
    expect(userCanWriteProductMaster({ role: "Accountant", permissions: ["masters", "accounts"] })).toBe(
      false
    );
  });

  it("Store Manager can write", () => {
    expect(userCanWriteProductMaster({ role: "Store Manager", permissions: ["inventory"] })).toBe(true);
  });

  it("Sales Manager can write products and pricing", () => {
    expect(userCanWriteProductMaster({ role: "Sales Manager", permissions: ["sales", "masters"] })).toBe(true);
  });
});
