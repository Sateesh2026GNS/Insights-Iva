import { STOCK_VALUE_OTHERS_KEY, colorPairForCategory } from "./stockValueCategoryPalette";

export function formatInrCompact(value) {
  const n = Number(value) || 0;
  if (n >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (n >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * @param {{ category: string, value: number, item_count?: number }[]} raw
 * @param {number} totalValue
 */
export function buildStockValueDonutSlices(raw, totalValue) {
  const total = Number(totalValue) || 0;
  const rows = (raw || [])
    .map((row) => ({
      category: row.category,
      value: Number(row.value) || 0,
      item_count: Number(row.item_count) || 0,
    }))
    .sort((a, b) => b.value - a.value);

  const withPct = rows.map((row) => ({
    ...row,
    pct: total > 0 ? (row.value / total) * 100 : 0,
  }));

  const major = withPct.filter((row) => row.pct >= 3 || row.category === "Unvalued");
  const minor = withPct.filter((row) => row.pct < 3 && row.category !== "Unvalued");
  const topSix = major.slice(0, 6);
  const restMajor = major.slice(6);

  const othersPool = [...minor, ...restMajor];
  const othersValue = othersPool.reduce((sum, row) => sum + row.value, 0);
  const othersCount = othersPool.reduce((sum, row) => sum + row.item_count, 0);

  const display = [...topSix];
  if (othersValue > 0 || othersCount > 0) {
    display.push({
      category: STOCK_VALUE_OTHERS_KEY,
      value: othersValue,
      item_count: othersCount,
      pct: total > 0 ? (othersValue / total) * 100 : 0,
    });
  }

  return display.map((row) => {
    const { color, ink } = colorPairForCategory(row.category);
    return { ...row, color, ink };
  });
}
