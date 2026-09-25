import { describe, expect, it } from "vitest";

import { normalizeGstin, validateGstin, validateGstinField } from "./gstin";

describe("validateGstin", () => {
  it("accepts empty GSTIN when optional", () => {
    expect(validateGstin("")).toBeNull();
    expect(validateGstin(null)).toBeNull();
    expect(validateGstin("   ")).toBeNull();
  });

  it("accepts a valid GSTIN with checksum (backend test vector)", () => {
    expect(validateGstin("27AAAAA0000A1Z2")).toBe("27AAAAA0000A1Z2");
    expect(validateGstin("27aaaaa0000a1z2")).toBe("27AAAAA0000A1Z2");
  });

  it("rejects invalid checksum", () => {
    expect(() => validateGstin("27AAAAA0000A1Z5")).toThrow(/checksum/i);
    expect(validateGstinField("27AAAAA0000A1Z5").ok).toBe(false);
    expect(validateGstinField("27AAAAA0000A1Z5").error).toBe("Enter a valid GSTIN.");
  });

  it("normalizes whitespace", () => {
    expect(normalizeGstin(" 27aaaaa0000a1z2 ")).toBe("27AAAAA0000A1Z2");
  });
});
