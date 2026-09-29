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

const WORD_VALUES = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  a: 1,
  an: 1,
  half: 0.5,
};

const SCALE_VALUES = {
  hundred: 100,
  hundreds: 100,
  h: 100,
  thousand: 1000,
  thousands: 1000,
  k: 1000,
  lakh: 100000,
  lakhs: 100000,
  lac: 100000,
  lacs: 100000,
  l: 100000,
  crore: 10000000,
  crores: 10000000,
  cr: 10000000,
  million: 1000000,
  millions: 1000000,
  m: 1000000,
};

/**
 * Checks if input contains only numeric digits, commas, spaces, or decimals (no shorthand letters/words).
 *
 * @param {number|string} input
 * @returns {boolean}
 */
export function isPureNumericInput(input) {
  if (input == null || input === "") return false;
  return /^[0-9,\s.]+$/.test(String(input).trim());
}

/**
 * Parses numeric input that may contain:
 * - Direct digits: "100", "100000", "1,00,000"
 * - Shorthand notation: "1 Lakh", "1.5L", "2 Cr", "50k", "1LAKH", "50K"
 * - English word numbers: "one lakh", "One Lakh", "two thousand five hundred", "fifty thousand"
 *
 * @param {number|string} input - User input string or number.
 * @returns {number|null} Parsed numeric value.
 */
export function parseShorthandNumber(input) {
  if (input == null || input === "") return null;
  if (typeof input === "number") return Number.isNaN(input) ? null : input;

  let str = String(input).trim().toLowerCase().replace(/,/g, "");
  if (!str) return null;

  // Direct numeric match
  const directNum = Number(str);
  if (!Number.isNaN(directNum)) return directNum;

  // Separate numbers attached to letters (e.g. "1.5lakh" -> "1.5 lakh", "50k" -> "50 k", "1L" -> "1 l")
  str = str.replace(/([0-9.]+)\s*([a-z]+)/gi, "$1 $2");
  str = str.replace(/-/g, " ");

  const tokens = str.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  let total = 0;
  let currentSegment = 0;
  let isValid = false;

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    // Check direct numeric token
    const num = Number(token);
    if (!Number.isNaN(num)) {
      currentSegment += num;
      isValid = true;
      continue;
    }

    // Check word number token (e.g. "one", "twenty")
    if (WORD_VALUES[token] !== undefined) {
      currentSegment += WORD_VALUES[token];
      isValid = true;
      continue;
    }

    // Check scale token (e.g. "lakh", "thousand", "crore", "hundred")
    if (SCALE_VALUES[token] !== undefined) {
      const scale = SCALE_VALUES[token];
      if (scale === 100) {
        currentSegment = (currentSegment === 0 ? 1 : currentSegment) * 100;
      } else {
        const seg = currentSegment === 0 ? 1 : currentSegment;
        total += seg * scale;
        currentSegment = 0;
      }
      isValid = true;
      continue;
    }

    // Unrecognized token -> invalid input
    return null;
  }

  total += currentSegment;
  return isValid ? total : null;
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


