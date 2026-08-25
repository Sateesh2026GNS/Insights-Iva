/**
 * Semantic tone classes for numeric / delta values in tables.
 * Green = positive, red = negative, slate = zero/neutral.
 */

import {
  valuePositiveClass,
  valueNegativeClass,
  valueNeutralClass,
} from "./classes";

export { valuePositiveClass, valueNegativeClass, valueNeutralClass };

/** @returns {'positive'|'negative'|'neutral'} */
export function resolveValueTone(value) {
  if (value == null || value === "" || value === "—") return "neutral";
  const n = typeof value === "number" ? value : Number(String(value).replace(/[₹,\s%]/g, ""));
  if (Number.isNaN(n) || n === 0) return "neutral";
  return n > 0 ? "positive" : "negative";
}

/** CSS class for a numeric cell based on sign. */
export function valueToneClass(value) {
  const tone = resolveValueTone(value);
  if (tone === "positive") return valuePositiveClass;
  if (tone === "negative") return valueNegativeClass;
  return valueNeutralClass;
}

/** Format ₹ amount with tone class when signed deltas are shown. */
export function formatSignedCurrency(amount, { prefix = "₹ ", locale = "en-IN" } = {}) {
  const n = Number(amount);
  if (Number.isNaN(n)) return { text: "—", className: valueNeutralClass };
  const text = `${prefix}${Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (n === 0) return { text, className: valueNeutralClass };
  if (n > 0) return { text: `${prefix}${n.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, className: valuePositiveClass };
  return { text: `−${prefix.trim()} ${Math.abs(n).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.replace(`${prefix.trim()} `, prefix), className: valueNegativeClass };
}
