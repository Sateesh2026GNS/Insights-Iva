import { describe, expect, it } from "vitest";

import { normalizeGstin, validateGstin, validateGstinField } from "./gstin";

describe("validateGstin", () => {
  it("accepts empty GSTIN when optional", () => {
    expect(validateGstin("")).toBeNull();
    expect(validateGstin(null)).toBeNull();
    expect(validateGstin("   ")).toBeNull();
  });

  it("accepts a 15-character alphanumeric GSTIN with at least one letter and number", () => {
    expect(validateGstin("27AAAAA0000A1Z2")).toBe("27AAAAA0000A1Z2");
    expect(validateGstin("27aaaaa0000a1z2")).toBe("27AAAAA0000A1Z2");
    expect(validateGstin("27AAAAA0000A1Z5")).toBe("27AAAAA0000A1Z5");
    expect(validateGstin("36CDEFG3456H1Z7")).toBe("36CDEFG3456H1Z7");
  });

  it("rejects when length is not 15", () => {
    expect(() => validateGstin("27AAAAA")).toThrow(/15 characters/i);
    expect(validateGstinField("27AAAAA").ok).toBe(false);
    expect(validateGstinField("27AAAAA").error).toBe("Enter a valid GSTIN.");
  });

  it("rejects when only numbers or only letters", () => {
    expect(() => validateGstin("123456789012345")).toThrow(/letter and one number/i);
    expect(validateGstinField("123456789012345").ok).toBe(false);
    expect(() => validateGstin("ABCDEFGHIJKLMNO")).toThrow(/letter and one number/i);
    expect(validateGstinField("ABCDEFGHIJKLMNO").ok).toBe(false);
  });

  it("normalizes whitespace", () => {
    expect(normalizeGstin(" 27aaaaa0000a1z2 ")).toBe("27AAAAA0000A1Z2");
  });
});
