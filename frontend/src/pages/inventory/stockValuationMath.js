import { formatInr } from "./eoqHelperMath";
import { formatNumber } from "./godownCapacityMath";

export { formatInr, formatNumber };

/** Sample date shown on the weighted-average sheet. */
export const SAMPLE_VALUATION_DATE = "19-Oct-2026";

export const SAMPLE_VALUATION_ITEMS = [
  { id: "rice", item: "Rice 25 kg bag", category: "Grains", openingQty: 2400, openingRate: 1120, purchaseQty: 4200, purchaseRate: 1150, closingQty: 3100 },
  { id: "wheat", item: "Wheat 50 kg bag", category: "Grains", openingQty: 1800, openingRate: 1420, purchaseQty: 2600, purchaseRate: 1450, closingQty: 1650 },
  { id: "sugar", item: "Sugar 50 kg bag", category: "Sugar", openingQty: 900, openingRate: 2120, purchaseQty: 2100, purchaseRate: 2150, closingQty: 1200 },
  { id: "cement", item: "Cement 50 kg bag", category: "Cement", openingQty: 600, openingRate: 365, purchaseQty: 3400, purchaseRate: 370, closingQty: 520 },
  { id: "biscuit", item: "Biscuit carton", category: "Packaged food", openingQty: 500, openingRate: 700, purchaseQty: 1500, purchaseRate: 720, closingQty: 640 },
  { id: "oil", item: "Edible oil 15 L tin", category: "Oil", openingQty: 650, openingRate: 2100, purchaseQty: 900, purchaseRate: 2150, closingQty: 900 },
  { id: "fert", item: "Fertiliser 50 kg bag", category: "Fertiliser", openingQty: 700, openingRate: 1330, purchaseQty: 2200, purchaseRate: 1350, closingQty: 1000 },
  { id: "mixed", item: "Mixed goods carton", category: "Other", openingQty: 120, openingRate: 820, purchaseQty: 300, purchaseRate: 850, closingQty: 150 },
  { id: "maida", item: "Maida 50 kg bag", category: "Grains", openingQty: 300, openingRate: 1780, purchaseQty: 700, purchaseRate: 1800, closingQty: 420 },
  { id: "toor", item: "Toor dal 30 kg bag", category: "Pulses", openingQty: 220, openingRate: 3550, purchaseQty: 400, purchaseRate: 3600, closingQty: 180 },
  { id: "chana", item: "Chana dal 30 kg bag", category: "Pulses", openingQty: 160, openingRate: 2850, purchaseQty: 300, purchaseRate: 2900, closingQty: 210 },
  { id: "poha", item: "Poha 25 kg bag", category: "Grains", openingQty: 140, openingRate: 1120, purchaseQty: 260, purchaseRate: 1150, closingQty: 170 },
  { id: "besan", item: "Besan 25 kg bag", category: "Grains", openingQty: 90, openingRate: 2150, purchaseQty: 200, purchaseRate: 2200, closingQty: 110 },
  { id: "salt", item: "Salt bale 25 x 1 kg", category: "Salt", openingQty: 300, openingRate: 540, purchaseQty: 600, purchaseRate: 550, closingQty: 380 },
  { id: "detergent", item: "Detergent carton 10 kg", category: "Packaged food", openingQty: 120, openingRate: 930, purchaseQty: 260, purchaseRate: 950, closingQty: 160 },
  { id: "mustard", item: "Mustard oil 15 L tin", category: "Oil", openingQty: 140, openingRate: 2400, purchaseQty: 260, purchaseRate: 2450, closingQty: 190 },
  { id: "cattle", item: "Cattle feed 50 kg bag", category: "Feed", openingQty: 260, openingRate: 1380, purchaseQty: 500, purchaseRate: 1400, closingQty: 300 },
  { id: "nails", item: "Nails 25 kg box", category: "Hardware", openingQty: 40, openingRate: 1880, purchaseQty: 20, purchaseRate: 1900, closingQty: 46 },
  { id: "pvc", item: "PVC pipe bundle 10 pcs", category: "Hardware", openingQty: 30, openingRate: 1580, purchaseQty: 20, purchaseRate: 1600, closingQty: 34 },
  { id: "tea", item: "Tea 250 g pack carton", category: "Packaged food", openingQty: 60, openingRate: 3150, purchaseQty: 140, purchaseRate: 3200, closingQty: 90 },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function roundRupee(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

export function valueStockLine(row) {
  const openingQty = Math.max(0, num(row.openingQty));
  const openingRate = Math.max(0, num(row.openingRate));
  const purchaseQty = Math.max(0, num(row.purchaseQty));
  const purchaseRate = Math.max(0, num(row.purchaseRate));
  const closingQty = Math.max(0, num(row.closingQty));
  const openingValue = openingQty * openingRate;
  const purchaseValue = purchaseQty * purchaseRate;
  const availableQty = openingQty + purchaseQty;
  const availableValue = openingValue + purchaseValue;
  const averageCost = availableQty > 0 ? availableValue / availableQty : 0;
  const closingValueExact = closingQty * averageCost;
  const closingValue = roundRupee(closingValueExact);
  const issuedQty = availableQty - closingQty;
  const aboveStock = closingQty > availableQty + 1e-6;

  return {
    id: row.id,
    item: String(row.item || "").trim() || "Item",
    category: String(row.category || "").trim() || "Other",
    openingQty,
    openingRate,
    purchaseQty,
    purchaseRate,
    closingQty,
    openingValue,
    purchaseValue,
    availableQty,
    availableValue,
    averageCost,
    closingValueExact,
    closingValue,
    issuedQty,
    aboveStock,
  };
}

/** Weighted-average stock valuation for a counted closing balance. */
export function planStockValuation(items) {
  const rows = (items || []).map(valueStockLine);
  const openingValue = rows.reduce((sum, row) => sum + row.openingValue, 0);
  const purchaseValue = rows.reduce((sum, row) => sum + row.purchaseValue, 0);
  const availableValue = openingValue + purchaseValue;
  const closingValueExact = rows.reduce((sum, row) => sum + row.closingValueExact, 0);
  const closingValue = roundRupee(closingValueExact);
  const issuedValue = availableValue - closingValue;
  const closingUnits = rows.reduce((sum, row) => sum + row.closingQty, 0);
  const ranked = [...rows].sort((a, b) => b.closingValueExact - a.closingValueExact || a.item.localeCompare(b.item));
  const top = ranked.slice(0, 10);
  const topRounded = top.reduce((sum, row) => sum + row.closingValue, 0);
  const topShare = closingValue > 0 ? (topRounded / closingValue) * 100 : 0;
  const biggest = ranked[0] || null;
  const aboveStockCount = rows.filter((row) => row.aboveStock).length;

  const byCategory = new Map();
  rows.forEach((row) => {
    byCategory.set(row.category, (byCategory.get(row.category) || 0) + row.closingValueExact);
  });
  const categories = [...byCategory.entries()]
    .map(([category, value]) => ({
      category,
      value,
      pct: closingValueExact > 0 ? (value / closingValueExact) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value || a.category.localeCompare(b.category));

  return {
    itemCount: rows.length,
    rows,
    openingValue,
    purchaseValue,
    availableValue,
    closingValue,
    issuedValue,
    closingUnits,
    top,
    topShare,
    biggest,
    aboveStockCount,
    categories,
    axisMax: Math.max(4000000, biggest?.closingValue || 0),
  };
}
