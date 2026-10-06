import { describe, it, expect } from "vitest";
import {
  formatNumber,
  formatAmount,
  formatQuantity,
  formatInr,
  parseShorthandNumber,
  numberToWords,
  isPureNumericInput,
  normalizeIndianCurrencyInput,
  formatIndianCurrencyField,
  parseIndianCurrencyToNumber,
  inrAmountToWords,
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
    it("parses shorthand expressions like 1 Lakh, 1.5 L, 2 Cr, 50k, 1LAKH, 50K", () => {
      expect(parseShorthandNumber("1 Lakh")).toBe(100000);
      expect(parseShorthandNumber("1.5 Lakh")).toBe(150000);
      expect(parseShorthandNumber("1.5 L")).toBe(150000);
      expect(parseShorthandNumber("2 Cr")).toBe(20000000);
      expect(parseShorthandNumber("50k")).toBe(50000);
      expect(parseShorthandNumber("1LAKH")).toBe(100000);
      expect(parseShorthandNumber("1L")).toBe(100000);
      expect(parseShorthandNumber("50K")).toBe(50000);
    });

    it("parses full English word numbers in any case", () => {
      expect(parseShorthandNumber("one lakh")).toBe(100000);
      expect(parseShorthandNumber("One Lakh")).toBe(100000);
      expect(parseShorthandNumber("ONE LAKH")).toBe(100000);
      expect(parseShorthandNumber("one lakh fifty thousand")).toBe(150000);
      expect(parseShorthandNumber("two thousand five hundred")).toBe(2500);
      expect(parseShorthandNumber("fifty thousand")).toBe(50000);
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

  describe("isPureNumericInput", () => {
    it("identifies pure numeric inputs vs shorthand/words", () => {
      expect(isPureNumericInput("100")).toBe(true);
      expect(isPureNumericInput("1,00,000")).toBe(true);
      expect(isPureNumericInput("1 Lakh")).toBe(false);
      expect(isPureNumericInput("1L")).toBe(false);
      expect(isPureNumericInput("one lakh")).toBe(false);
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

  describe("Indian currency input helpers", () => {
    it("formats amounts with Indian grouping", () => {
      expect(formatIndianCurrencyField("1000")).toBe("1,000");
      expect(formatIndianCurrencyField("10000")).toBe("10,000");
      expect(formatIndianCurrencyField("100000")).toBe("1,00,000");
      expect(formatIndianCurrencyField("2500000")).toBe("25,00,000");
      expect(formatIndianCurrencyField("10000000")).toBe("1,00,00,000");
      expect(formatIndianCurrencyField("12500000")).toBe("1,25,00,000");
      expect(formatIndianCurrencyField("2500000.5")).toBe("25,00,000.5");
    });

    it("normalizes pasted comma-separated values", () => {
      expect(normalizeIndianCurrencyInput("2500000")).toBe("2500000");
      expect(normalizeIndianCurrencyInput("2,500,000")).toBe("2500000");
      expect(normalizeIndianCurrencyInput("25,00,000")).toBe("2500000");
      expect(normalizeIndianCurrencyInput("")).toBeNull();
      expect(normalizeIndianCurrencyInput("-100")).toBeNull();
    });

    it("parses numeric API values without commas", () => {
      expect(parseIndianCurrencyToNumber("25,00,000")).toBe(2500000);
      expect(parseIndianCurrencyToNumber("")).toBe(0);
      expect(parseIndianCurrencyToNumber("2500000.50")).toBe(2500000.5);
    });

    it("converts amounts to INR words for lead form", () => {
      expect(inrAmountToWords("")).toBe("");
      expect(inrAmountToWords("0")).toBe("Zero Rupees Only");
      expect(inrAmountToWords("2")).toBe("Two Rupees Only");
      expect(inrAmountToWords("25")).toBe("Twenty Five Rupees Only");
      expect(inrAmountToWords("2500")).toBe("Two Thousand Five Hundred Rupees Only");
      expect(inrAmountToWords("250000")).toBe("Two Lakh Fifty Thousand Rupees Only");
      expect(inrAmountToWords("2500000")).toBe("Twenty Five Lakh Rupees Only");
      expect(inrAmountToWords("12500000")).toBe("One Crore Twenty Five Lakh Rupees Only");
    });
  });
});
