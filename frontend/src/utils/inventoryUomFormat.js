const UOM_FIELDS = ["unit", "uom", "base_unit", "unit_of_measure"];

function normalizeUom(row) {
  const value = UOM_FIELDS.map((field) => row?.[field]).find(
    (candidate) => candidate != null && String(candidate).trim(),
  );
  return value == null ? "" : String(value).trim();
}

export function formatInventoryQuantity(value, unit) {
  const amount = Number(value);
  const formatted = Number.isFinite(amount)
    ? amount.toLocaleString("en-IN", { maximumFractionDigits: 3 })
    : "0";
  const normalizedUnit = unit == null ? "" : String(unit).trim();
  return normalizedUnit ? `${formatted} ${normalizedUnit}` : formatted;
}

export function singleUomInRows(rows = []) {
  const units = new Set((Array.isArray(rows) ? rows : []).map(normalizeUom).filter(Boolean));
  return units.size === 1 ? [...units][0] : "";
}

export function summarizeQuantitiesByUom(rows = [], quantityField = "quantity") {
  const totals = new Map();
  for (const row of Array.isArray(rows) ? rows : []) {
    const unit = normalizeUom(row) || "Units";
    const quantity = Number(row?.[quantityField] ?? row?.quantity ?? row?.available ?? 0);
    totals.set(unit, (totals.get(unit) || 0) + (Number.isFinite(quantity) ? quantity : 0));
  }
  if (!totals.size) return "0";
  return [...totals.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([unit, quantity]) => formatInventoryQuantity(quantity, unit))
    .join(" · ");
}

export function pickDefaultWarehouse(warehouses = [], { preferTypes = [], nameIncludes = [] } = {}) {
  if (!Array.isArray(warehouses) || warehouses.length === 0) return "";
  const types = preferTypes.map((value) => String(value).toLowerCase());
  const preferredByType = warehouses.find((warehouse) => {
    const type = String(warehouse?.type || warehouse?.warehouse_type || "").toLowerCase();
    return types.includes(type);
  });
  if (preferredByType) return String(preferredByType.id);

  const names = nameIncludes.map((value) => String(value).toLowerCase());
  const preferredByName = warehouses.find((warehouse) => {
    const name = String(warehouse?.name || "").toLowerCase();
    return names.some((candidate) => name.includes(candidate));
  });
  return String((preferredByName || warehouses[0])?.id ?? "");
}
