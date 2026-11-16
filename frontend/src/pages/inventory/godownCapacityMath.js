export const SAMPLE_GODOWN = {
  businessName: "Shree Ganesh Warehousing",
  length: 100,
  width: 40,
  clearHeight: 18,
  gap: 3,
  aislesPct: 30,
  nearlyFullPct: 85,
};

export const SAMPLE_ITEMS = [
  { id: "rice", item: "Rice 25 kg bag", unit: "bag", length: 2.3, width: 1.4, layerHeight: 0.45, maxLayers: 25, sharePct: 20, stock: 3100, kg: 25 },
  { id: "wheat", item: "Wheat 50 kg bag", unit: "bag", length: 3, width: 1.7, layerHeight: 0.6, maxLayers: 20, sharePct: 20, stock: 1650, kg: 50 },
  { id: "sugar", item: "Sugar 50 kg bag", unit: "bag", length: 2.8, width: 1.6, layerHeight: 0.5, maxLayers: 20, sharePct: 18, stock: 1200, kg: 50 },
  { id: "cement", item: "Cement 50 kg bag", unit: "bag", length: 2.3, width: 1.5, layerHeight: 0.5, maxLayers: 10, sharePct: 10, stock: 520, kg: 50 },
  { id: "biscuit", item: "Biscuit carton", unit: "carton", length: 2, width: 1.3, layerHeight: 1.1, maxLayers: 8, sharePct: 8, stock: 640, kg: 6 },
  { id: "oil", item: "Edible oil 15 L tin", unit: "tin", length: 0.8, width: 0.8, layerHeight: 1.2, maxLayers: 5, sharePct: 8, stock: 1000, kg: 13.7 },
  { id: "fert", item: "Fertiliser 50 kg bag", unit: "bag", length: 2.6, width: 1.6, layerHeight: 0.55, maxLayers: 15, sharePct: 11, stock: 900, kg: 50 },
  { id: "mixed", item: "Mixed goods carton", unit: "carton", length: 1.5, width: 1.5, layerHeight: 1, maxLayers: 6, sharePct: 6, stock: 150, kg: 10 },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function planGodown(input, items) {
  const length = Math.max(0, num(input.length));
  const width = Math.max(0, num(input.width));
  const clearHeight = Math.max(0, num(input.clearHeight));
  const gap = Math.max(0, num(input.gap));
  const aislesPct = Math.min(100, Math.max(0, num(input.aislesPct)));
  const nearlyFullPct = Math.min(100, Math.max(0, num(input.nearlyFullPct)));
  const floorArea = length * width;
  const aisleArea = floorArea * (aislesPct / 100);
  const usableFloor = floorArea - aisleArea;
  const highestStack = Math.max(0, clearHeight - gap);
  const usableVolume = usableFloor * highestStack;

  const rows = (items || []).map((item) => {
    const footprint = Math.max(0, num(item.length) * num(item.width));
    const layerHeight = Math.max(0, num(item.layerHeight));
    const maxLayers = Math.max(0, Math.floor(num(item.maxLayers)));
    const heightLayers = layerHeight > 0 ? Math.floor(highestStack / layerHeight) : 0;
    const layers = Math.min(maxLayers, heightLayers);
    const share = Math.max(0, num(item.sharePct)) / 100;
    const stock = Math.max(0, num(item.stock));
    const unitsPerLayer = footprint > 0 ? Math.floor((usableFloor * share) / footprint) : 0;
    const capacity = unitsPerLayer * layers;
    const freeUnits = capacity - stock;
    const pct = capacity > 0 ? (stock / capacity) * 100 : 0;
    const floorTaken = layers > 0 ? (stock / layers) * footprint : 0;
    const tonnes = (stock * Math.max(0, num(item.kg))) / 1000;
    const nearlyFull = pct >= nearlyFullPct;
    return {
      ...item,
      footprint,
      layers,
      capacity,
      freeUnits,
      pct,
      floorTaken,
      tonnes,
      status: nearlyFull ? "Nearly full" : "Space",
    };
  });

  const floorTaken = rows.reduce((sum, row) => sum + row.floorTaken, 0);
  const stockTonnes = rows.reduce((sum, row) => sum + row.tonnes, 0);
  const freeFloor = Math.max(0, usableFloor - floorTaken);
  const fullPct = usableFloor > 0 ? (floorTaken / usableFloor) * 100 : 0;
  const nearlyFullCount = rows.filter((row) => row.status === "Nearly full").length;
  const fullest = rows.reduce((best, row) => (row.pct > (best?.pct || 0) ? row : best), null);

  return {
    floorArea,
    aisleArea,
    usableFloor,
    highestStack,
    usableVolume,
    floorTaken,
    freeFloor,
    fullPct,
    stockTonnes,
    itemCount: rows.length,
    nearlyFullCount,
    fullestName: fullest?.item || "—",
    rows,
    floorParts: [
      { label: "Taken by stock", amount: floorTaken, pct: floorArea > 0 ? (floorTaken / floorArea) * 100 : 0 },
      { label: "Free usable floor", amount: freeFloor, pct: floorArea > 0 ? (freeFloor / floorArea) * 100 : 0 },
      { label: "Aisles, gangways, office", amount: aisleArea, pct: floorArea > 0 ? (aisleArea / floorArea) * 100 : 0 },
    ],
  };
}

export function formatNumber(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
