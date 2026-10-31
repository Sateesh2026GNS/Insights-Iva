import { formatNumber } from "./godownCapacityMath";

export { formatNumber };

/** Quantity can be typed as units, weight, or pieces. */
export const QUANTITY_BASIS = [
  { id: "units", label: "Units" },
  { id: "kg", label: "Kg" },
  { id: "quintal", label: "Quintal" },
  { id: "tonne", label: "Tonne" },
  { id: "pieces", label: "Pieces" },
];

export const DEFAULT_CONVERSION = {
  itemId: "wheat",
  quantity: 250,
  basis: "units",
};

/**
 * Sample item master shared by the godown toolkit.
 * Yellow inputs: unit, kg, pieces, stack, cft. Blue columns are calculated.
 * Nails, PVC and tea sit below the first screen of the sample sheet and keep
 * the toolkit at 20 items in 10 categories.
 */
export const SAMPLE_UNIT_ITEMS = [
  { id: "rice", item: "Rice 25 kg bag", category: "Grains", unit: "bag", kgPerUnit: 25, piecesPerUnit: 0, unitsPerStack: 500, cftPerUnit: 1.45 },
  { id: "wheat", item: "Wheat 50 kg bag", category: "Grains", unit: "bag", kgPerUnit: 50, piecesPerUnit: 0, unitsPerStack: 400, cftPerUnit: 2.6 },
  { id: "sugar", item: "Sugar 50 kg bag", category: "Sugar", unit: "bag", kgPerUnit: 50, piecesPerUnit: 0, unitsPerStack: 400, cftPerUnit: 2.4 },
  { id: "cement", item: "Cement 50 kg bag", category: "Cement", unit: "bag", kgPerUnit: 50, piecesPerUnit: 0, unitsPerStack: 100, cftPerUnit: 1.4 },
  { id: "biscuit", item: "Biscuit carton", category: "Packaged food", unit: "carton", kgPerUnit: 6, piecesPerUnit: 48, unitsPerStack: 80, cftPerUnit: 0.8 },
  { id: "oil", item: "Edible oil 15 L tin", category: "Oil", unit: "tin", kgPerUnit: 13.7, piecesPerUnit: 0, unitsPerStack: 80, cftPerUnit: 0.9 },
  { id: "fert", item: "Fertiliser 50 kg bag", category: "Fertiliser", unit: "bag", kgPerUnit: 50, piecesPerUnit: 0, unitsPerStack: 300, cftPerUnit: 2.2 },
  { id: "mixed", item: "Mixed goods carton", category: "Other", unit: "carton", kgPerUnit: 10, piecesPerUnit: 12, unitsPerStack: 54, cftPerUnit: 2.4 },
  { id: "maida", item: "Maida 50 kg bag", category: "Grains", unit: "bag", kgPerUnit: 50, piecesPerUnit: 0, unitsPerStack: 400, cftPerUnit: 2.7 },
  { id: "toor", item: "Toor dal 30 kg bag", category: "Pulses", unit: "bag", kgPerUnit: 30, piecesPerUnit: 0, unitsPerStack: 400, cftPerUnit: 1.6 },
  { id: "chana", item: "Chana dal 30 kg bag", category: "Pulses", unit: "bag", kgPerUnit: 30, piecesPerUnit: 0, unitsPerStack: 400, cftPerUnit: 1.6 },
  { id: "poha", item: "Poha 25 kg bag", category: "Grains", unit: "bag", kgPerUnit: 25, piecesPerUnit: 0, unitsPerStack: 300, cftPerUnit: 2.2 },
  { id: "besan", item: "Besan 25 kg bag", category: "Grains", unit: "bag", kgPerUnit: 25, piecesPerUnit: 0, unitsPerStack: 400, cftPerUnit: 1.5 },
  { id: "salt", item: "Salt bale 25 x 1 kg", category: "Packaged food", unit: "bale", kgPerUnit: 25, piecesPerUnit: 25, unitsPerStack: 300, cftPerUnit: 1.3 },
  { id: "detergent", item: "Detergent carton 10 kg", category: "Packaged food", unit: "carton", kgPerUnit: 10, piecesPerUnit: 20, unitsPerStack: 100, cftPerUnit: 1.6 },
  { id: "mustard", item: "Mustard oil 15 L tin", category: "Oil", unit: "tin", kgPerUnit: 13.6, piecesPerUnit: 0, unitsPerStack: 80, cftPerUnit: 0.9 },
  { id: "cattle", item: "Cattle feed 50 kg bag", category: "Feed", unit: "bag", kgPerUnit: 50, piecesPerUnit: 0, unitsPerStack: 300, cftPerUnit: 2.6 },
  { id: "nails", item: "Nails 25 kg box", category: "Hardware", unit: "box", kgPerUnit: 25, piecesPerUnit: 0, unitsPerStack: 80, cftPerUnit: 1.2 },
  { id: "pvc", item: "PVC pipe bundle 10 pcs", category: "Hardware", unit: "bundle", kgPerUnit: 18, piecesPerUnit: 10, unitsPerStack: 20, cftPerUnit: 4.5 },
  { id: "tea", item: "Tea 250 g pack carton", category: "Packaged food", unit: "carton", kgPerUnit: 5, piecesPerUnit: 20, unitsPerStack: 100, cftPerUnit: 0.7 },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function itemFactors(row) {
  const kgPerUnit = Math.max(0, num(row.kgPerUnit));
  const piecesPerUnit = Math.max(0, num(row.piecesPerUnit));
  const unitsPerStack = Math.max(0, num(row.unitsPerStack));
  const cftPerUnit = Math.max(0, num(row.cftPerUnit));
  const unitsPerQuintal = kgPerUnit > 0 ? 100 / kgPerUnit : 0;
  const unitsPerTonne = kgPerUnit > 0 ? 1000 / kgPerUnit : 0;
  const kgPerStack = kgPerUnit * unitsPerStack;
  const tonnesPerStack = kgPerStack / 1000;
  const kgPerPiece = piecesPerUnit > 0 ? kgPerUnit / piecesPerUnit : 0;
  const cftPerTonne = kgPerUnit > 0 ? (cftPerUnit * 1000) / kgPerUnit : 0;

  return {
    id: row.id,
    item: String(row.item || "").trim() || "Item",
    category: String(row.category || "").trim() || "Other",
    unit: String(row.unit || "").trim() || "unit",
    kgPerUnit,
    piecesPerUnit,
    unitsPerStack,
    cftPerUnit,
    unitsPerQuintal,
    unitsPerTonne,
    kgPerStack,
    tonnesPerStack,
    kgPerPiece,
    cftPerTonne,
  };
}

/** How many stacks are needed to hold this many units. */
export function stacksNeeded(units, unitsPerStack) {
  const count = Math.max(0, num(units));
  const perStack = Math.max(0, num(unitsPerStack));
  if (count <= 0 || perStack <= 0) return 0;
  return Math.ceil(count / perStack - 1e-9);
}

export function convertQuantity(item, quantity, basis) {
  const factors = item.kgPerUnit != null && item.unitsPerQuintal != null ? item : itemFactors(item);
  const amount = Math.max(0, num(quantity));
  const mode = QUANTITY_BASIS.some((option) => option.id === basis) ? basis : "units";
  let units = amount;
  if (mode === "kg") units = factors.kgPerUnit > 0 ? amount / factors.kgPerUnit : 0;
  else if (mode === "quintal") units = factors.kgPerUnit > 0 ? (amount * 100) / factors.kgPerUnit : 0;
  else if (mode === "tonne") units = factors.kgPerUnit > 0 ? (amount * 1000) / factors.kgPerUnit : 0;
  else if (mode === "pieces") units = factors.piecesPerUnit > 0 ? amount / factors.piecesPerUnit : 0;

  const kg = units * factors.kgPerUnit;
  const pieces = factors.piecesPerUnit > 0 ? units * factors.piecesPerUnit : 0;

  return {
    ...factors,
    basis: mode,
    quantity: amount,
    units,
    kg,
    quintal: kg / 100,
    tonne: kg / 1000,
    pieces,
    stacks: stacksNeeded(units, factors.unitsPerStack),
  };
}

/** Unit conversion plus the item-master rollup for the toolkit page. */
export function planUnitConverter(items, input = DEFAULT_CONVERSION) {
  const rows = (items || []).map(itemFactors);
  const itemCount = rows.length;
  const categoryOrder = [];
  const categoryCounts = new Map();
  rows.forEach((row) => {
    if (!categoryCounts.has(row.category)) categoryOrder.push(row.category);
    categoryCounts.set(row.category, (categoryCounts.get(row.category) || 0) + 1);
  });
  const categories = categoryOrder.map((category) => {
    const count = categoryCounts.get(category) || 0;
    return {
      category,
      count,
      pct: itemCount > 0 ? (count / itemCount) * 100 : 0,
    };
  });
  const heaviest = rows.reduce((best, row) => (row.kgPerUnit > (best?.kgPerUnit || 0) ? row : best), null);
  const selected = rows.find((row) => row.id === input?.itemId) || rows[0] || null;
  const conversion = selected ? convertQuantity(selected, input?.quantity, input?.basis) : null;
  const axisMax = Math.max(60, ...rows.map((row) => row.kgPerUnit), 0);

  return {
    rows,
    categories,
    itemCount,
    categoryCount: categories.length,
    heaviestName: heaviest?.item || "—",
    selected,
    conversion,
    axisMax,
  };
}
