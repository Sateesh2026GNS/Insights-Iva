/** Client-side list behaviour for the Supplier & Vendor Master Tracker. */

export function isCompliantSupplier(row) {
  const approved = String(row?.approval_status || "").toLowerCase() === "approved";
  const active = String(row?.status || "").toLowerCase() === "active";
  return approved && active && Boolean(row?.gstin || row?.pan);
}

export function filterSuppliers(rows, filters = {}) {
  const term = String(filters.search || "").trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (term) {
      const haystack = [
        row.name,
        row.vendor_type,
        row.country,
        row.category,
        row.contact,
        row.email,
        row.phone,
        row.payment_terms,
        row.status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    if (filters.vendorType && row.vendor_type !== filters.vendorType) return false;
    if (filters.country && (row.country || "Not specified") !== filters.country) return false;
    if (filters.status && String(row.status || "").toLowerCase() !== filters.status) return false;
    if (filters.compliantOnly && !isCompliantSupplier(row)) return false;
    return true;
  });
}

export function sortSuppliers(rows, sortKey, direction = "asc") {
  const factor = direction === "desc" ? -1 : 1;
  return [...(rows || [])].sort((a, b) => {
    if (sortKey === "rating") {
      const left = a.rating == null ? -1 : Number(a.rating);
      const right = b.rating == null ? -1 : Number(b.rating);
      return (left - right) * factor;
    }
    return String(a?.[sortKey] ?? "").localeCompare(String(b?.[sortKey] ?? ""), undefined, {
      sensitivity: "base",
    }) * factor;
  });
}

export function paginateSuppliers(rows, page, pageSize) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * pageSize;
  return { page: current, pages, total, rows: rows.slice(start, start + pageSize) };
}
