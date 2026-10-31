import { formatInr } from "./eoqHelperMath";
import { formatNumber } from "./godownCapacityMath";
import { SAMPLE_UNIT_ITEMS } from "./unitConverterMath";

export { formatInr, formatNumber, SAMPLE_UNIT_ITEMS };

export const DEFAULT_TRUCK_LOAD = {
  itemId: "wheat",
  kgPerUnit: 50,
  cftPerUnit: 2.6,
  units: 1200,
  truckId: "truck16",
  loadLimit: 100,
};

export const SAMPLE_TRUCKS = [
  { id: "pickup", name: "Pickup 1.5 t", capacityKg: 1500, capacityCft: 300, freight: 1800 },
  { id: "lcv", name: "LCV 4 t", capacityKg: 4000, capacityCft: 650, freight: 3500 },
  { id: "truck9", name: "Truck 9 t (6 wheel)", capacityKg: 9000, capacityCft: 1100, freight: 7500 },
  { id: "truck16", name: "Truck 16 t (10 wheel)", capacityKg: 16000, capacityCft: 1500, freight: 12000 },
  { id: "truck21", name: "Truck 21 t (12 wheel)", capacityKg: 21000, capacityCft: 1800, freight: 15500 },
  { id: "container", name: "Container 32 ft", capacityKg: 15000, capacityCft: 2300, freight: 18000 },
];

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** Axis that lands on 80 for a ₹60 max and 120 for a 100% max. */
export function chartAxis(value) {
  const n = Math.max(0, num(value));
  if (n <= 0) return 4;
  const rough = n * 1.05;
  const exp = Math.floor(Math.log10(rough));
  const base = 10 ** exp;
  const frac = rough / base;
  const nice = [1, 1.2, 2, 2.4, 4, 5, 8, 10].find((step) => step + 1e-9 >= frac) || 10;
  return nice * base;
}

function unitsFit(capacity, limitFraction, perUnit) {
  if (perUnit <= 0) return Number.POSITIVE_INFINITY;
  if (capacity <= 0 || limitFraction <= 0) return 0;
  return Math.floor((capacity * limitFraction) / perUnit + 1e-9);
}

export function planTruckRow(truck, shipment) {
  const capacityKg = Math.max(0, num(truck.capacityKg));
  const capacityCft = Math.max(0, num(truck.capacityCft));
  const freight = Math.max(0, num(truck.freight));
  const byWeight = unitsFit(capacityKg, shipment.limitFraction, shipment.kgPerUnit);
  const byVolume = unitsFit(capacityCft, shipment.limitFraction, shipment.cftPerUnit);
  const finite = [byWeight, byVolume].filter((value) => Number.isFinite(value));
  const perTruck = finite.length ? Math.min(...finite) : 0;
  let limitedBy = "Weight";
  if (Number.isFinite(byVolume) && byVolume < byWeight) limitedBy = "Volume";
  else if (byWeight === byVolume) limitedBy = "Weight";
  const units = shipment.units;
  const trucks = perTruck > 0 ? Math.ceil(units / perTruck - 1e-9) : 0;
  const usedKg = units * shipment.kgPerUnit;
  const usedCft = units * shipment.cftPerUnit;
  const loadWeight = trucks > 0 && capacityKg > 0 ? (usedKg / (trucks * capacityKg)) * 100 : 0;
  const loadVolume = trucks > 0 && capacityCft > 0 ? (usedCft / (trucks * capacityCft)) * 100 : 0;
  const freightTotal = trucks * freight;
  const tonnes = usedKg / 1000;
  const lastTruck = trucks > 0 ? units - (trucks - 1) * perTruck : 0;

  return {
    id: truck.id,
    name: String(truck.name || "").trim() || "Truck",
    capacityKg,
    capacityCft,
    freight,
    byWeight: Number.isFinite(byWeight) ? byWeight : 0,
    byVolume: Number.isFinite(byVolume) ? byVolume : 0,
    perTruck,
    limitedBy: perTruck > 0 ? limitedBy : "—",
    trucks,
    loadWeight,
    loadVolume,
    freightTotal,
    freightPerUnit: units > 0 ? freightTotal / units : 0,
    freightPerTonne: tonnes > 0 ? freightTotal / tonnes : 0,
    lastTruck,
  };
}

/** Units per truck from weight and volume, then trucks, load % and freight. */
export function planTruckLoad(input = DEFAULT_TRUCK_LOAD, trucks = SAMPLE_TRUCKS) {
  const kgPerUnit = Math.max(0, num(input?.kgPerUnit));
  const cftPerUnit = Math.max(0, num(input?.cftPerUnit));
  const units = Math.max(0, num(input?.units));
  const loadLimit = Math.max(0, num(input?.loadLimit));
  const shipment = { kgPerUnit, cftPerUnit, units, limitFraction: loadLimit / 100 };
  const rows = (trucks || []).map((truck) => planTruckRow(truck, shipment));
  const selected = rows.find((row) => row.id === input?.truckId) || rows[0] || null;
  const cheapest = rows.reduce((best, row) => (row.freightPerUnit < (best?.freightPerUnit ?? Infinity) ? row : best), null);
  const freightMax = Math.max(0, ...rows.map((row) => row.freightPerUnit));
  const loadMax = Math.max(0, ...rows.flatMap((row) => [row.loadWeight, row.loadVolume]));
  const item = SAMPLE_UNIT_ITEMS.find((row) => row.id === input?.itemId);

  return {
    itemId: input?.itemId || "",
    itemName: item?.item || "Item",
    kgPerUnit,
    cftPerUnit,
    units,
    loadLimit,
    rows,
    selected,
    cheapest,
    freightAxis: chartAxis(freightMax),
    loadAxis: chartAxis(loadMax),
  };
}
