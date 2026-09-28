import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatAmount,
  formatQuantity,
  formatInr,
  parseShorthandNumber,
  numberToWords,
} from "./numberFormat";

describe("numberFormat utility module", () => {
  describe("formatNumber", () => {
    it("formats integers with comma separation in Indian locale", () => {
      expect(formatNumber(1000)).toBe("1,000");
      expect(formatNumber(100000)).toBe("1,00,000");
      expect(formatNumber(10000000)).toBe("1,00,00,000");
    });

    it("handles zero and negative numbers", () => {
      expect(formatNumber(0)).toBe("0");
      expect(formatNumber(-5000)).toBe("-5,000");
    });

    it("handles fallback for null, undefined, empty, or NaN", () => {
      expect(formatNumber(null)).toBe("0");
      expect(formatNumber(undefined)).toBe("0");
      expect(formatNumber("")).toBe("0");
      expect(formatNumber("abc")).toBe("0");
      expect(formatNumber(null, { fallback: "—" })).toBe("—");
    });

    it("handles decimal precision options", () => {
      expect(formatNumber(1234.5678, { decimals: 2 })).toBe("1,234.57");
      expect(formatNumber(1234, { minDecimals: 2 })).toBe("1,234.00");
    });
  });

  describe("formatAmount", () => {
    it("formats currency amounts with symbol and commas", () => {
      expect(formatAmount(50000)).toBe("₹50,000");
      expect(formatAmount(1250000)).toBe("₹12,50,000");
    });

    it("formats decimal currency amounts when requested", () => {
      expect(formatAmount(1234.5, { decimals: 2 })).toBe("₹1,234.50");
    });

    it("supports custom currency symbols", () => {
      expect(formatAmount(1000, { symbol: "$" })).toBe("$1,000");
    });
  });

  describe("formatQuantity", () => {
    it("formats quantity with unit and commas", () => {
      expect(formatQuantity(1500, "NOS")).toBe("1,500 NOS");
      expect(formatQuantity(25000, "KG")).toBe("25,000 KG");
      expect(formatQuantity(500)).toBe("500");
    });
  });

  describe("formatInr", () => {
    it("formats INR currency values cleanly with full comma separation", () => {
      expect(formatInr(100000)).toBe("₹1,00,000");
      expect(formatInr(15000000)).toBe("₹1,50,00,000");
      expect(formatInr(0)).toBe("₹0");
      expect(formatInr(null)).toBe("₹0");
    });
  });

  describe("parseShorthandNumber", () => {
    it("parses shorthand expressions like 1 Lakh, 1.5 L, 2 Cr, 50k", () => {
      expect(parseShorthandNumber("1 Lakh")).toBe(100000);
      expect(parseShorthandNumber("1.5 Lakh")).toBe(150000);
      expect(parseShorthandNumber("1.5 L")).toBe(150000);
      expect(parseShorthandNumber("2 Cr")).toBe(20000000);
      expect(parseShorthandNumber("50k")).toBe(50000);
    });

    it("parses raw digits and comma-separated numeric strings", () => {
      expect(parseShorthandNumber("100000")).toBe(100000);
      expect(parseShorthandNumber("1,00,000")).toBe(100000);
      expect(parseShorthandNumber(500)).toBe(500);
    });

    it("returns null for invalid inputs", () => {
      expect(parseShorthandNumber("")).toBeNull();
      expect(parseShorthandNumber(null)).toBeNull();
      expect(parseShorthandNumber("invalid text")).toBeNull();
    });
  });

  describe("numberToWords", () => {
    it("converts numbers to Indian currency/quantity words", () => {
      expect(numberToWords(4000)).toBe("Four Thousand");
      expect(numberToWords(100000)).toBe("One Lakh");
      expect(numberToWords(150000)).toBe("One Lakh Fifty Thousand");
      expect(numberToWords(25000)).toBe("Twenty Five Thousand");
      expect(numberToWords(500)).toBe("Five Hundred");
      expect(numberToWords(10000000)).toBe("One Crore");
    });
  });
});
