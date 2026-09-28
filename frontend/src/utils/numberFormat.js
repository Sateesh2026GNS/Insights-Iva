/**
 * Utility functions for formatting numbers, quantities, amounts, and percentages
 * with proper comma separation (e.g. 1,000, 10,000, 1,00,000).
 */

/**
 * Formats a raw number or string representation of a number with comma separators.
 * Preserves decimals if present or specified.
 *
 * @param {number|string} value - The numeric value to format.
 * @param {Object} [options] - Formatting options.
 * @param {number} [options.decimals] - Maximum decimal places to show.
 * @param {number} [options.minDecimals=0] - Minimum decimal places to show.
 * @param {string} [options.fallback="0"] - Fallback string if value is null/undefined/invalid.
 * @param {string} [options.locale="en-IN"] - Locale for formatting (default en-IN).
 * @returns {string} Formatted number string with commas.
 */
export function formatNumber(value, options = {}) {
  if (value == null || value === "") {
    return options.fallback !== undefined ? options.fallback : "0";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : "0";
  }

  const {
    decimals,
    minDecimals = 0,
    locale = "en-IN",
  } = options;

  const fmtOptions = {
    minimumFractionDigits: minDecimals,
  };
  if (decimals !== undefined) {
    fmtOptions.maximumFractionDigits = decimals;
  }

  return num.toLocaleString(locale, fmtOptions);
}

/**
 * Formats currency amount with currency symbol and commas.
 *
 * @param {number|string} value - Amount to format.
 * @param {Object} [options]
 * @param {string} [options.symbol="₹"] - Currency symbol (e.g. "₹").
 * @param {number} [options.decimals] - Maximum decimal places.
 * @param {number} [options.minDecimals] - Minimum decimal places.
 * @param {string} [options.fallback="₹0"] - Fallback if invalid.
 * @param {string} [options.locale="en-IN"] - Locale.
 * @returns {string} Formatted amount string like "₹1,23,456" or "₹1,23,456.50".
 */
export function formatAmount(value, options = {}) {
  if (value == null || value === "") {
    return options.fallback !== undefined ? options.fallback : "₹0";
  }
  const num = Number(value);
  if (Number.isNaN(num)) {
    return options.fallback !== undefined ? options.fallback : "₹0";
  }

  const symbol = options.symbol !== undefined ? options.symbol : "₹";
  const locale = options.locale || "en-IN";

  const fmtOptions = {};
  if (options.decimals !== undefined) {
    fmtOptions.maximumFractionDigits = options.decimals;
    fmtOptions.minimumFractionDigits = options.minDecimals !== undefined ? options.minDecimals : options.decimals;
  }

  const formattedStr = num.toLocaleString(locale, fmtOptions);
  return symbol ? `${symbol}${formattedStr}` : formattedStr;
}

/**
 * Formats quantity with commas and optional unit.
 *
 * @param {number|string} qty - Quantity value.
 * @param {string} [unit=""] - Unit string (e.g. "NOS", "KG").
 * @param {Object} [options]
 * @returns {string} Formatted quantity like "1,500 NOS" or "500".
 */
export function formatQuantity(qty, unit = "", options = {}) {
  const formatted = formatNumber(qty, options);
  return unit ? `${formatted} ${unit}` : formatted;
}

/**
 * Formats INR amount with comma separators.
 *
 * @param {number|string} v - Amount value.
 * @param {Object} [options]
 * @returns {string} Formatted INR string like "₹1,23,456.00" or "₹1,23,456".
 */
export function formatInr(v, options = {}) {
  if (v == null || v === "") return "₹0";
  const n = Number(v);
  if (Number.isNaN(n)) return "₹0";
  const fmtOptions = {};
  if (options.decimals !== undefined) {
    fmtOptions.maximumFractionDigits = options.decimals;
    fmtOptions.minimumFractionDigits = options.minDecimals !== undefined ? options.minDecimals : options.decimals;
  }
  return `₹${n.toLocaleString(options.locale || "en-IN", fmtOptions)}`;
}

/**
 * Parses numeric input that may contain shorthand notation (e.g. "1 Lakh", "1.5L", "2 Cr", "50k", "100000").
 * Returns the parsed number or null if invalid/empty.
 *
 * @param {number|string} input - User input string or number.
 * @returns {number|null} Parsed numeric value.
 */
export function parseShorthandNumber(input) {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isNaN(input) ? null : input;

  const raw = String(input).trim().replace(/,/g, "");
  if (!raw) return null;

  // Direct numeric match
  const directNum = Number(raw);
  if (!Number.isNaN(directNum)) return directNum;

  // Shorthand match regex (e.g. 1.5 Lakh, 2 Cr, 50k, 1.5 L)
  const regex = /^([+-]?\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/;
  const match = raw.match(regex);
  if (!match) return null;

  const numPart = Number(match[1]);
  if (Number.isNaN(numPart)) return null;

  const unitPart = match[2].toLowerCase();

  if (["lakh", "lakhs", "lac", "lacs", "l"].includes(unitPart)) {
    return numPart * 100000;
  }
  if (["crore", "crores", "cr"].includes(unitPart)) {
    return numPart * 10000000;
  }
  if (["k", "thousand", "thousands"].includes(unitPart)) {
    return numPart * 1000;
  }
  if (["m", "million", "millions"].includes(unitPart)) {
    return numPart * 1000000;
  }

  return null;
}

/**
 * Converts a number into Indian currency/quantity words.
 * Example: 4000 -> "Four Thousand", 100000 -> "One Lakh", 150000 -> "One Lakh Fifty Thousand".
 *
 * @param {number|string} n - Numeric value.
 * @returns {string} Number formatted in words.
 */
export function numberToWords(n) {
  if (n == null || Number.isNaN(Number(n)) || Number(n) === 0) return "";
  let num = Math.floor(Math.abs(Number(n)));
  if (num === 0) return "Zero";

  const units = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function convertBelowThousand(val) {
    let str = "";
    if (val >= 100) {
      str += units[Math.floor(val / 100)] + " Hundred ";
      val %= 100;
    }
    if (val >= 20) {
      str += tens[Math.floor(val / 10)] + (val % 10 !== 0 ? " " + units[val % 10] : "");
    } else if (val > 0) {
      str += units[val];
    }
    return str.trim();
  }

  let result = "";

  if (Math.floor(num / 10000000) > 0) {
    const crore = Math.floor(num / 10000000);
    result += convertBelowThousand(crore) + " Crore ";
    num %= 10000000;
  }

  if (Math.floor(num / 100000) > 0) {
    const lakh = Math.floor(num / 100000);
    result += convertBelowThousand(lakh) + " Lakh ";
    num %= 100000;
  }

  if (Math.floor(num / 1000) > 0) {
    const thousand = Math.floor(num / 1000);
    result += convertBelowThousand(thousand) + " Thousand ";
    num %= 1000;
  }

  if (num > 0) {
    result += convertBelowThousand(num);
  }

  return result.trim();
}


