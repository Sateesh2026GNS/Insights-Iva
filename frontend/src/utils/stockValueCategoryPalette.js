/** Stable palette reused from inventory stock valuation donut (restore_ui/StockValuation). */
export const STOCK_VALUE_CATEGORY_COLORS = [
  ["#1e3a8a", "#fff"],
  ["#16a34a", "#052e16"],
  ["#f97316", "#fff"],
  ["#38bdf8", "#0c4a6e"],
  ["#7c3aed", "#fff"],
  ["#0f766e", "#fff"],
  ["#ca8a04", "#fff"],
  ["#64748b", "#fff"],
  ["#78716c", "#fff"],
  ["#0369a1", "#fff"],
  ["#94a3b8", "#0f172a"],
];

export const STOCK_VALUE_OTHERS_KEY = "Others";

function hashCategoryKey(key) {
  let hash = 0;
  const text = String(key || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

export function colorPairForCategory(category) {
  const index = hashCategoryKey(category) % STOCK_VALUE_CATEGORY_COLORS.length;
  const [color, ink] = STOCK_VALUE_CATEGORY_COLORS[index];
  return { color, ink, index };
}
