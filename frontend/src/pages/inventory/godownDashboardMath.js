import { formatInr, formatNumber } from "./eoqHelperMath";
import { DEFAULT_EOQ_INPUT, planEoq } from "./eoqHelperMath";
import { SAMPLE_GODOWN, SAMPLE_ITEMS, planGodown } from "./godownCapacityMath";
import { planHamali } from "./hamaliCostMath";
import { planTruckLoad } from "./truckLoadMath";
import { SAMPLE_VALUATION_ITEMS, planStockValuation } from "./stockValuationMath";
import { SAMPLE_UNIT_ITEMS } from "./unitConverterMath";
import { planDamage } from "./damageLossMath";
import { planStorageQuotation } from "./storageQuotationMath";
import { planGatePass } from "./gatePassMath";

export { formatInr, formatNumber };

/** Figures from toolkit sheets that are not separate pages yet. */
export const DASHBOARD_SNAPSHOT = {
  businessName: "Shree Ganesh Warehousing",
  fullPct: 68.8,
  freeSqft: 875,
  tonnes: 314,
  reorderCount: 2,
  reorderValue: 2066140,
  rentMonth: 51000,
  rentParties: 7,
  runningCost: 243680,
  oldStockValue: 1183040,
  deadStockValue: 140779,
  toRevise: 9,
  costsTracked: 13,
  marginChange: -8360,
  ageBuckets: [
    { label: "0 to 30 days", value: 9200000 },
    { label: "31 to 60 days", value: 3600000 },
    { label: "61 to 90 days", value: 350000 },
    { label: "Over 90 days", value: 1183040 },
  ],
  costHeads: [
    { label: "Hamali", amount: 129480 },
    { label: "Staff", amount: 43862 },
    { label: "Rent or EMI", amount: 41426 },
    { label: "Electricity", amount: 9747 },
    { label: "Security guard", amount: 7310 },
    { label: "Pest control", amount: 4874 },
    { label: "Insurance", amount: 3655 },
    { label: "Repairs and upkeep", amount: 2437 },
    { label: "Other", amount: 889 },
  ],
  daysLeft: [
    { item: "Rice 25 kg bag", days: 26 },
    { item: "Wheat 50 kg bag", days: 18 },
    { item: "Sugar 50 kg bag", days: 27 },
    { item: "Cement 50 kg bag", days: 22 },
    { item: "Biscuit carton", days: 14 },
    { item: "Edible oil 15 L tin", days: 36 },
    { item: "Fertiliser 50 kg bag", days: 20 },
    { item: "Maida 50 kg bag", days: 16 },
    { item: "Toor dal 30 kg bag", days: 12 },
    { item: "Chana dal 30 kg bag", days: 15 },
    { item: "Salt bale 25 x 1 kg", days: 24 },
    { item: "Mustard oil 15 L tin", days: 19 },
  ],
};

export const DASHBOARD_LINKS = [
  { tool: "01", area: "Space", metric: "Usable floor taken", to: "/inventory/godown-planner" },
  { tool: "02", area: "Items", metric: "Items on the item master", to: "/inventory/unit-converter" },
  { tool: "03", area: "Stock", metric: "Closing stock value", to: "/inventory/stock-valuation" },
  { tool: "04", area: "Reorder", metric: "Items to order now", to: "" },
  { tool: "05", area: "EOQ", metric: "Practical order size", to: "/inventory/eoq-helper" },
  { tool: "06", area: "Storage", metric: "Rent a month at today's stock", to: "" },
  { tool: "07", area: "Hamali", metric: "Hamali a month", to: "/inventory/hamali-cost" },
  { tool: "08", area: "Trucks", metric: "Trucks needed for the load", to: "/inventory/truck-load" },
  { tool: "09", area: "Ageing", metric: "Dead stock value", to: "" },
  { tool: "10", area: "Loss", metric: "Loss % of stock value", to: "/inventory/damage-loss" },
  { tool: "11", area: "Cost", metric: "Cost per bag handled", to: "" },
  { tool: "12", area: "Quotation", metric: "Storage quotation total", to: "/inventory/storage-quotation" },
  { tool: "13", area: "Gate pass", metric: "Weight on the document (kg)", to: "/inventory/gate-pass" },
  { tool: "14", area: "Revisions", metric: "Margin change a month", to: "" },
];

/** One screen of the sample toolkit: live tools where they exist, sheet figures for the rest. */
export function planGodownDashboard() {
  const space = planGodown(SAMPLE_GODOWN, SAMPLE_ITEMS);
  const stock = planStockValuation(SAMPLE_VALUATION_ITEMS);
  const hamali = planHamali();
  const trucks = planTruckLoad();
  const loss = planDamage();
  const quote = planStorageQuotation();
  const gate = planGatePass();
  const eoq = planEoq(DEFAULT_EOQ_INPUT);
  const snap = DASHBOARD_SNAPSHOT;
  const costPerBag = hamali.bagsMonth > 0 ? snap.runningCost / hamali.bagsMonth : 0;
  const costTotal = snap.costHeads.reduce((sum, row) => sum + row.amount, 0);
  const values = {
    "01": `${formatNumber(snap.fullPct, 1)}%`,
    "02": formatNumber(SAMPLE_UNIT_ITEMS.length),
    "03": formatInr(stock.closingValue),
    "04": formatNumber(snap.reorderCount),
    "05": formatNumber(eoq.practicalOrder),
    "06": formatInr(snap.rentMonth),
    "07": formatInr(hamali.month),
    "08": formatNumber(trucks.selected?.trucks || 0),
    "09": formatInr(snap.deadStockValue),
    10: `${formatNumber(loss.lossPct, 2)}%`,
    11: formatInr(costPerBag, 2),
    12: formatInr(quote.total),
    13: formatNumber(gate.totalKg),
    14: formatInr(snap.marginChange),
  };

  return {
    businessName: snap.businessName,
    fullPct: snap.fullPct,
    freeSqft: snap.freeSqft,
    tonnes: snap.tonnes,
    stockValue: stock.closingValue,
    stockUnits: stock.closingUnits,
    topStock: stock.top,
    stockAxis: stock.axisMax,
    spaceRows: space.rows,
    reorderCount: snap.reorderCount,
    reorderValue: snap.reorderValue,
    rentMonth: snap.rentMonth,
    rentParties: snap.rentParties,
    hamaliMonth: hamali.month,
    hamaliPerBag: hamali.perBag,
    runningCost: snap.runningCost,
    costPerBag,
    eoqOrder: eoq.practicalOrder,
    eoqItem: eoq.itemName,
    trucks: trucks.selected?.trucks || 0,
    freightPerUnit: trucks.selected?.freightPerUnit || 0,
    oldStockValue: snap.oldStockValue,
    lossValue: loss.lossValue,
    lossPct: loss.lossPct,
    toRevise: snap.toRevise,
    costsTracked: snap.costsTracked,
    quoteTotal: quote.total,
    gateKg: gate.totalKg,
    marginChange: snap.marginChange,
    deadStockValue: snap.deadStockValue,
    ageBuckets: snap.ageBuckets,
    ageAxis: 10000000,
    costHeads: snap.costHeads.map((row) => ({
      ...row,
      pct: costTotal > 0 ? (row.amount / costTotal) * 100 : 0,
    })),
    daysLeft: snap.daysLeft,
    daysAxis: 40,
    rows: DASHBOARD_LINKS.map((row) => ({ ...row, value: values[row.tool] })),
  };
}
