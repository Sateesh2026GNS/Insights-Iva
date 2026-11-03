import { formatInr } from "./eoqHelperMath";
import { formatNumber } from "./godownCapacityMath";

export { formatInr, formatNumber };

/** Sample "today" on the hamali sheet, so days-ago matches the truck log. */
export const SAMPLE_HAMALI_TODAY = "19-Oct-26";

export const HAMALI_BASIS = [
  { id: "bag", label: "Per bag" },
  { id: "tonne", label: "Per tonne" },
  { id: "truck", label: "Per truck" },
];

export const DEFAULT_HAMALI = {
  basis: "bag",
  rateBagIn: 6,
  rateBagOut: 6,
  rateTonne: 180,
  rateTruck: 2500,
  bagsIn: 450,
  bagsOut: 380,
  kgPerBag: 50,
  bagsPerTruck: 400,
  workingDays: 26,
};

/**
 * Truck log from the sample sheet. The last two rows sit below the fold and
 * bring the log to 10 trucks, 3,860 bags and one truck on 19-Oct-26.
 */
export const SAMPLE_TRUCK_LOG = [
  { id: "t1", item: "Rice 25 kg bag", date: "13-Oct-26", vehicle: "RJ 14 GB 4471", direction: "In", bags: 600, kgPerBag: 25 },
  { id: "t2", item: "Wheat 50 kg bag", date: "13-Oct-26", vehicle: "RJ 14 GC 1093", direction: "Out", bags: 320, kgPerBag: 50 },
  { id: "t3", item: "Sugar 50 kg bag", date: "14-Oct-26", vehicle: "RJ 27 GA 7718", direction: "In", bags: 400, kgPerBag: 50 },
  { id: "t4", item: "Cement 50 kg bag", date: "14-Oct-26", vehicle: "RJ 14 GD 2265", direction: "Out", bags: 300, kgPerBag: 50 },
  { id: "t5", item: "Wheat 50 kg bag", date: "15-Oct-26", vehicle: "RJ 14 GB 8802", direction: "In", bags: 420, kgPerBag: 50 },
  { id: "t6", item: "Rice 25 kg bag", date: "15-Oct-26", vehicle: "RJ 14 GE 3317", direction: "Out", bags: 500, kgPerBag: 25 },
  { id: "t7", item: "Fertiliser 50 kg bag", date: "16-Oct-26", vehicle: "RJ 27 GB 5524", direction: "In", bags: 400, kgPerBag: 50 },
  { id: "t8", item: "Sugar 50 kg bag", date: "17-Oct-26", vehicle: "RJ 14 GC 6140", direction: "Out", bags: 280, kgPerBag: 50 },
  { id: "t9", item: "Maida 50 kg bag", date: "18-Oct-26", vehicle: "RJ 14 GA 9096", direction: "In", bags: 400, kgPerBag: 50 },
  { id: "t10", item: "Cement 50 kg bag", date: "19-Oct-26", vehicle: "RJ 14 GF 1182", direction: "Out", bags: 240, kgPerBag: 50 },
];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function parseSheetDate(text) {
  const match = String(text || "").trim().match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (!match) return null;
  const month = MONTHS.findIndex((name) => name.toLowerCase() === match[2].toLowerCase());
  if (month < 0) return null;
  let year = Number(match[3]);
  if (year < 100) year += 2000;
  return Date.UTC(year, month, Number(match[1]));
}

export function daysAgo(dateText, asOf = SAMPLE_HAMALI_TODAY) {
  const from = parseSheetDate(dateText);
  const to = parseSheetDate(asOf);
  if (from == null || to == null) return null;
  return Math.round((to - from) / 86400000);
}

function fullTrucks(bags, bagsPerTruck) {
  if (bags <= 0 || bagsPerTruck <= 0) return 0;
  return Math.ceil(bags / bagsPerTruck - 1e-9);
}

function basisLabel(id) {
  return HAMALI_BASIS.find((option) => option.id === id)?.label || "Per bag";
}

/** Ceiling that lands on the sample axes (₹2,50,000 and ₹4,000). */
export function chartCeiling(value) {
  const n = Math.max(0, num(value));
  if (n <= 0) return 1;
  const rough = n * 1.08;
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const frac = rough / base;
  const nice = [1, 2, 2.5, 4, 5, 10].find((step) => frac <= step) || 10;
  return nice * base;
}

function dayAmount(kind, totals, rates) {
  if (kind === "tonne") return totals.tonnes * rates.rateTonne;
  if (kind === "truck") return totals.trucks * rates.rateTruck;
  return totals.bagsIn * rates.rateBagIn + totals.bagsOut * rates.rateBagOut;
}

export function costTruckRow(row, rates, basis) {
  const bags = Math.max(0, num(row.bags));
  const kgPerBag = Math.max(0, num(row.kgPerBag));
  const tonnes = (bags * kgPerBag) / 1000;
  const direction = String(row.direction || "In").toLowerCase() === "out" ? "Out" : "In";
  let hamali = bags * (direction === "Out" ? rates.rateBagOut : rates.rateBagIn);
  if (basis === "tonne") hamali = tonnes * rates.rateTonne;
  if (basis === "truck") hamali = rates.rateTruck;
  return {
    id: row.id,
    item: String(row.item || "").trim() || "Item",
    date: String(row.date || ""),
    vehicle: String(row.vehicle || "").trim() || "Truck",
    direction,
    bags,
    kgPerBag,
    tonnes,
    hamali,
    perBag: bags > 0 ? hamali / bags : 0,
    daysAgo: daysAgo(row.date),
  };
}

/** Hamali for one day, a month, the three-way compare, and the truck log. */
export function planHamali(input = DEFAULT_HAMALI, log = SAMPLE_TRUCK_LOG) {
  const basis = HAMALI_BASIS.some((option) => option.id === input?.basis) ? input.basis : "bag";
  const rates = {
    rateBagIn: Math.max(0, num(input?.rateBagIn)),
    rateBagOut: Math.max(0, num(input?.rateBagOut)),
    rateTonne: Math.max(0, num(input?.rateTonne)),
    rateTruck: Math.max(0, num(input?.rateTruck)),
  };
  const bagsIn = Math.max(0, num(input?.bagsIn));
  const bagsOut = Math.max(0, num(input?.bagsOut));
  const kgPerBag = Math.max(0, num(input?.kgPerBag));
  const bagsPerTruck = Math.max(0, num(input?.bagsPerTruck));
  const workingDays = Math.max(0, num(input?.workingDays));
  const bags = bagsIn + bagsOut;
  const tonnes = (bags * kgPerBag) / 1000;
  const trucks = fullTrucks(bagsIn, bagsPerTruck) + fullTrucks(bagsOut, bagsPerTruck);
  const totals = { bagsIn, bagsOut, bags, tonnes, trucks };
  const amounts = {
    bag: dayAmount("bag", totals, rates),
    tonne: dayAmount("tonne", totals, rates),
    truck: dayAmount("truck", totals, rates),
  };
  const compare = HAMALI_BASIS.map((option) => {
    const day = amounts[option.id];
    return {
      id: option.id,
      label: option.label,
      day,
      month: day * workingDays,
      perBag: bags > 0 ? day / bags : 0,
      perTonne: tonnes > 0 ? day / tonnes : 0,
    };
  });
  const cheapest = compare.reduce((best, row) => (row.day < best.day ? row : best), compare[0]);
  const selected = compare.find((row) => row.id === basis) || compare[0];
  const rows = (log || []).map((row) => costTruckRow(row, rates, basis));
  const logBags = rows.reduce((sum, row) => sum + row.bags, 0);
  const logHamali = rows.reduce((sum, row) => sum + row.hamali, 0);
  const monthMax = Math.max(0, ...compare.map((row) => row.month));
  const truckMax = Math.max(0, ...rows.map((row) => row.hamali));

  return {
    basis,
    basisLabel: basisLabel(basis),
    ...rates,
    kgPerBag,
    bagsPerTruck,
    workingDays,
    bags,
    tonnes,
    trucks,
    dayBag: amounts.bag,
    dayTonne: amounts.tonne,
    dayTruck: amounts.truck,
    day: selected.day,
    perBag: selected.perBag,
    month: selected.month,
    bagsMonth: bags * workingDays,
    cheapestId: cheapest?.id || "bag",
    cheapestLabel: cheapest?.label || "Per bag",
    savingMonth: selected.month - (cheapest?.month || 0),
    compare,
    log: rows,
    trucksLogged: rows.length,
    logBags,
    logHamali,
    hamaliPerTruck: rows.length > 0 ? logHamali / rows.length : 0,
    trucksToday: rows.filter((row) => row.daysAgo === 0).length,
    monthAxis: chartCeiling(monthMax),
    truckAxis: chartCeiling(truckMax),
  };
}
