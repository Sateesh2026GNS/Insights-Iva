import { formatNumber } from "./godownCapacityMath";

export { formatNumber };

export const SAMPLE_EOQ_PRESETS = [
  {
    id: "wheat",
    itemName: "Wheat 50 kg bag",
    dailyUse: 90,
    workingDays: 300,
    costPerOrder: 1200,
    costPerUnit: 1437.73,
    holdingPct: 20,
    lotSize: 50,
  },
  {
    id: "rice",
    itemName: "Rice 25 kg bag",
    dailyUse: 120,
    workingDays: 300,
    costPerOrder: 900,
    costPerUnit: 980,
    holdingPct: 18,
    lotSize: 25,
  },
  {
    id: "sugar",
    itemName: "Sugar 50 kg bag",
    dailyUse: 45,
    workingDays: 300,
    costPerOrder: 1100,
    costPerUnit: 2150,
    holdingPct: 22,
    lotSize: 50,
  },
];

export const DEFAULT_EOQ_INPUT = { ...SAMPLE_EOQ_PRESETS[0] };

export const EOQ_ORDER_SIZE_SCENARIOS = [200, 300, 500, 750, 1000, 1500, 2000];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function roundPracticalOrder(eoq, lotSize) {
  const lot = Math.max(1, Math.floor(num(lotSize)));
  const raw = Math.max(0, num(eoq));
  if (raw <= 0) return 0;
  const lots = Math.max(1, Math.round(raw / lot));
  return lots * lot;
}

/** Classic EOQ with practical lot rounding. */
export function planEoq(input) {
  const itemName = String(input.itemName || "").trim() || "Item";
  const dailyUse = Math.max(0, num(input.dailyUse));
  const workingDays = Math.max(0, num(input.workingDays));
  const costPerOrder = Math.max(0, num(input.costPerOrder));
  const costPerUnit = Math.max(0, num(input.costPerUnit));
  const holdingPct = Math.min(100, Math.max(0, num(input.holdingPct)));
  const lotSize = Math.max(1, Math.floor(num(input.lotSize) || 1));

  const yearlyDemand = dailyUse * workingDays;
  const holdingPerUnit = costPerUnit * (holdingPct / 100);
  const eoqRaw =
    yearlyDemand > 0 && costPerOrder > 0 && holdingPerUnit > 0
      ? Math.sqrt((2 * yearlyDemand * costPerOrder) / holdingPerUnit)
      : 0;
  const practicalOrder = roundPracticalOrder(eoqRaw, lotSize);
  const ordersPerYear = practicalOrder > 0 ? yearlyDemand / practicalOrder : 0;
  const daysBetween = ordersPerYear > 0 ? workingDays / ordersPerYear : 0;
  const orderingCostYear = ordersPerYear * costPerOrder;
  const holdingCostYear = (practicalOrder / 2) * holdingPerUnit;
  const totalCostYear = orderingCostYear + holdingCostYear;
  const stockValueOneOrder = practicalOrder * costPerUnit;

  const scenarioRows = EOQ_ORDER_SIZE_SCENARIOS.map((orderSize) => {
    const orders = orderSize > 0 ? yearlyDemand / orderSize : 0;
    const ordering = orders * costPerOrder;
    const holding = (orderSize / 2) * holdingPerUnit;
    const total = ordering + holding;
    const aboveEoq = Math.max(0, total - totalCostYear);
    return {
      orderSize,
      ordersPerYear: orders,
      orderingCost: ordering,
      holdingCost: holding,
      totalCost: total,
      aboveEoqCost: aboveEoq,
    };
  });

  const minTotal = scenarioRows.reduce(
    (min, row) => (row.totalCost < min ? row.totalCost : min),
    Number.POSITIVE_INFINITY
  );

  const chartSizes = [];
  for (let q = 200; q <= 2000; q += 50) chartSizes.push(q);
  const costCurve = chartSizes.map((orderSize) => {
    const orders = orderSize > 0 ? yearlyDemand / orderSize : 0;
    return {
      orderSize,
      orderingCost: orders * costPerOrder,
      holdingCost: (orderSize / 2) * holdingPerUnit,
      totalCost: orders * costPerOrder + (orderSize / 2) * holdingPerUnit,
      ordersPerYear: orders,
    };
  });

  return {
    itemName,
    dailyUse,
    workingDays,
    costPerOrder,
    costPerUnit,
    holdingPct,
    lotSize,
    yearlyDemand,
    holdingPerUnit,
    eoqRaw,
    practicalOrder,
    ordersPerYear,
    daysBetween,
    orderingCostYear,
    holdingCostYear,
    totalCostYear,
    stockValueOneOrder,
    scenarioRows,
    minScenarioTotal: Number.isFinite(minTotal) ? minTotal : 0,
    costCurve,
  };
}

export function formatInr(value, digits = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}
