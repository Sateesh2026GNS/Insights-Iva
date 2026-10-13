/** Inventory quantity / UOM display helpers for stock list pages. */

function uomFromRow(row) {
  const u =
    row?.uom ||
    row?.unit_of_measure ||
    row?.unit ||
    row?.stock_uom ||
    row?.primary_uom ||
    "";
  return String(u).trim();
}

export function formatInventoryQuantity(value, unit) {
  const n = Number(value);
  const qty = Number.isFinite(n) ? n : 0;
  const u = String(unit || "").trim();
  const formatted = qty.toLocaleString("en-IN", { maximumFractionDigits: 3 });
  return u ? `${formatted} ${u}` : formatted;
}

export function singleUomInRows(rows = []) {
  const units = new Set();
  rows.forEach((r) => {
    const u = uomFromRow(r);
    if (u) units.add(u);
  });
  if (units.size === 1) return [...units][0];
  return "";
}

export function summarizeQuantitiesByUom(rows = [], field = "available") {
  const totals = new Map();
  rows.forEach((r) => {
    const u = uomFromRow(r) || "units";
    const n = Number(r[field] ?? r.quantity ?? 0) || 0;
    totals.set(u, (totals.get(u) || 0) + n);
  });
  if (!totals.size) return "0";
  return [...totals.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([u, n]) => formatInventoryQuantity(n, u))
    .join(" · ");
}

export function pickDefaultWarehouse(warehouses = [], { preferTypes = [], nameIncludes = [] } = {}) {
  const list = Array.isArray(warehouses) ? warehouses : [];
  if (!list.length) return null;
  const norm = (s) => String(s || "").toLowerCase();
  const typeMatch = list.find((w) => {
    const t = norm(w.type || w.warehouse_type);
    return preferTypes.some((p) => t.includes(norm(p)));
  });
  if (typeMatch) return typeMatch;
  const nameMatch = list.find((w) => {
    const name = norm(w.name);
    return nameIncludes.some((frag) => name.includes(norm(frag)));
  });
  if (nameMatch) return nameMatch;
  return list[0];
}
