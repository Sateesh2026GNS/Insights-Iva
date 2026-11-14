import { formatInr, formatNumber } from "./stockValuationMath";
import { SAMPLE_VALUATION_ITEMS, roundRupee, valueStockLine } from "./stockValuationMath";
import { chartAxis } from "./truckLoadMath";

export { chartAxis, formatInr, formatNumber, roundRupee };

export const SAMPLE_COUNT_DATE = "19-Oct-2026";

export const DEFAULT_DAMAGE = {
  date: SAMPLE_COUNT_DATE,
  allowedPct: 0.5,
};

/** Cause list on the sample sheet. Only the first four are used by the count. */
export const LOSS_CAUSES = ["Rats", "Handling", "Moisture", "Leakage", "Insects", "Theft", "Spillage"];

const COUNT_DRAFT = [
  { id: "rice", goodCount: 3093, damaged: 4, cause: "Rats" },
  { id: "wheat", goodCount: 1648, damaged: 2, cause: "Handling" },
  { id: "sugar", goodCount: 1196, damaged: 3, cause: "Moisture" },
  { id: "cement", goodCount: 514, damaged: 6, cause: "Moisture" },
  { id: "biscuit", goodCount: 638, damaged: 1, cause: "Handling" },
  { id: "oil", goodCount: 897, damaged: 2, cause: "Leakage" },
  { id: "fert", goodCount: 1000, damaged: 0, cause: "" },
  { id: "maida", goodCount: 418, damaged: 1, cause: "Rats" },
  { id: "toor", goodCount: 180, damaged: 0, cause: "" },
  { id: "salt", goodCount: 379, damaged: 1, cause: "Moisture" },
  { id: "mustard", goodCount: 190, damaged: 0, cause: "" },
  { id: "tea", goodCount: 90, damaged: 0, cause: "" },
];

/** Physical count against Tool 03 closing qty and weighted-average rate. */
export const SAMPLE_DAMAGE_ROWS = COUNT_DRAFT.map((row) => {
  const source = SAMPLE_VALUATION_ITEMS.find((item) => item.id === row.id);
  const valued = valueStockLine(source);
  return {
    id: row.id,
    item: valued.item,
    systemQty: valued.closingQty,
    goodCount: row.goodCount,
    damaged: row.damaged,
    cause: row.cause,
    rate: valued.averageCost,
  };
});

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function planDamageLine(row, allowedPct) {
  const systemQty = Math.max(0, num(row.systemQty));
  const goodCount = Math.max(0, num(row.goodCount));
  const damaged = Math.max(0, num(row.damaged));
  const rate = Math.max(0, num(row.rate));
  const shortage = Math.max(0, systemQty - goodCount - damaged);
  const excess = Math.max(0, goodCount + damaged - systemQty);
  const lossUnits = shortage + damaged;
  const lossExact = lossUnits * rate;
  const stockExact = systemQty * rate;
  const lossPct = systemQty > 0 ? (lossUnits / systemQty) * 100 : 0;
  const cause = String(row.cause || "").trim();
  let check = "Within limit";
  if (excess > 0) check = "Excess";
  else if (lossUnits <= 0) check = "No loss";
  else if (lossPct > num(allowedPct) + 1e-9) check = "Above limit";

  return {
    id: row.id,
    item: String(row.item || "").trim() || "Item",
    systemQty,
    goodCount,
    damaged,
    cause,
    rate,
    shortage,
    excess,
    lossUnits,
    lossExact,
    lossValue: roundRupee(lossExact),
    stockExact,
    lossPct,
    check,
  };
}

/** Shortage, damage, loss value and the cause split for one stock count. */
export function planDamage(input = DEFAULT_DAMAGE, rows = SAMPLE_DAMAGE_ROWS) {
  const allowedPct = Math.max(0, num(input?.allowedPct));
  const lines = (rows || []).map((row) => planDamageLine(row, allowedPct));
  const systemQty = lines.reduce((sum, row) => sum + row.systemQty, 0);
  const goodCount = lines.reduce((sum, row) => sum + row.goodCount, 0);
  const damaged = lines.reduce((sum, row) => sum + row.damaged, 0);
  const lossUnits = lines.reduce((sum, row) => sum + row.lossUnits, 0);
  const lossExact = lines.reduce((sum, row) => sum + row.lossExact, 0);
  const stockExact = lines.reduce((sum, row) => sum + row.stockExact, 0);
  const lossValue = roundRupee(lossExact);
  const stockValue = roundRupee(stockExact);
  const lossPct = stockExact > 0 ? (lossExact / stockExact) * 100 : 0;
  const biggest = lines.reduce((best, row) => (row.lossExact > (best?.lossExact || 0) ? row : best), null);
  const causeMap = new Map();
  let noCauseExact = 0;
  lines.forEach((row) => {
    if (row.lossExact <= 0) return;
    if (!row.cause) {
      noCauseExact += row.lossExact;
      return;
    }
    causeMap.set(row.cause, (causeMap.get(row.cause) || 0) + row.lossExact);
  });
  const causes = [...causeMap.entries()]
    .map(([cause, exact]) => ({ cause, exact, value: roundRupee(exact) }))
    .sort((a, b) => b.exact - a.exact || a.cause.localeCompare(b.cause));
  const causeTotal = causes.reduce((sum, row) => sum + row.exact, 0) + noCauseExact;
  const causeShares = causes.map((row) => ({
    ...row,
    pct: causeTotal > 0 ? (row.exact / causeTotal) * 100 : 0,
  }));
  const topCause = causeShares[0]?.cause || "—";
  const valueMax = Math.max(0, ...lines.map((row) => row.lossValue));

  return {
    date: String(input?.date || "").trim() || SAMPLE_COUNT_DATE,
    allowedPct,
    lines,
    itemCount: lines.length,
    systemQty,
    goodCount,
    damaged,
    lossUnits,
    lossValue,
    stockValue,
    lossPct,
    aboveLimit: lines.filter((row) => row.check === "Above limit").length,
    excessItems: lines.filter((row) => row.excess > 0).length,
    biggestName: biggest?.lossExact > 0 ? biggest.item : "—",
    topCause,
    causeCount: LOSS_CAUSES.length,
    noCauseValue: roundRupee(noCauseExact),
    causes: causeShares,
    valueAxis: chartAxis(valueMax),
  };
}
