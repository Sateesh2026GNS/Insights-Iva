export function formatInventoryQuantity(value, unit) {
  const num = Number(value || 0);
  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return unit ? `${formatted} ${unit}` : formatted;
}

export function pickDefaultWarehouse(warehouses = [], options = {}) {
  if (!Array.isArray(warehouses) || warehouses.length === 0) return "";
  const preferTypes = (options.preferTypes || []).map((t) => String(t).toLowerCase());
  const nameIncludes = (options.nameIncludes || []).map((n) => String(n).toLowerCase());

  // 1. Match by warehouse type
  if (preferTypes.length > 0) {
    const matchedByType = warehouses.find((w) =>
      preferTypes.includes(String(w?.warehouse_type || w?.type || "").toLowerCase())
    );
    if (matchedByType) return String(matchedByType.id);
  }

  // 2. Match by warehouse name substring
  if (nameIncludes.length > 0) {
    const matchedByName = warehouses.find((w) => {
      const name = String(w?.name || "").toLowerCase();
      return nameIncludes.some((sub) => name.includes(sub));
    });
    if (matchedByName) return String(matchedByName.id);
  }

  // 3. Fallback to first warehouse
  return String(warehouses[0]?.id || "");
}

export function singleUomInRows(rows = []) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  const units = new Set();
  for (const r of rows) {
    const u = r?.unit || r?.uom;
    if (u) units.add(String(u).trim());
  }
  if (units.size === 1) {
    return Array.from(units)[0];
  }
  return null;
}

export function summarizeQuantitiesByUom(rows = [], field = "available") {
  if (!Array.isArray(rows) || rows.length === 0) return "0";
  const totals = {};
  for (const r of rows) {
    const unit = String(r?.unit || r?.uom || "units").trim();
    const qty = Number(r?.[field] ?? r?.quantity ?? 0) || 0;
    totals[unit] = (totals[unit] || 0) + qty;
  }

  const entries = Object.entries(totals).filter(([, val]) => val > 0);
  if (entries.length === 0) return "0";

  return entries
    .map(([unit, val]) => formatInventoryQuantity(val, unit))
    .join(", ");
}
