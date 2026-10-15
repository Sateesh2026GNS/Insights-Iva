/** Client-side BOM quantity helpers (mirrors backend gross math). */

export function grossComponentQuantity(lineQty, scrapPercent) {
  const qty = Number(lineQty) || 0;
  const scrap = Number(scrapPercent) || 0;
  const factor = 1 + scrap / 100;
  return Math.round(qty * factor * 10000) / 10000;
}

export function bomCostIncomplete(components) {
  if (!components?.length) return false;
  return components.some((c) => c.missing_price);
}

export function bomCostTotal(components) {
  let total = 0;
  let incomplete = false;
  for (const line of components || []) {
    if (line.missing_price || line.line_cost == null) {
      incomplete = true;
      continue;
    }
    total += Number(line.line_cost) || 0;
  }
  return { total, incomplete };
}
