export function filterClients(rows, { search = "", region = "", status = "" } = {}) {
  const needle = search.trim().toLowerCase();
  return (rows || []).filter((row) => {
    if (region && row.region !== region) return false;
    if (status && String(row.status || "").toLowerCase() !== status.toLowerCase()) return false;
    if (!needle) return true;
    const haystack = [row.name, row.code, row.contact, row.email, row.phone]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

export function sortClients(rows, sortKey, sortDir) {
  const direction = sortDir === "desc" ? -1 : 1;
  const copy = [...(rows || [])];
  copy.sort((a, b) => {
    const left = a?.[sortKey] ?? "";
    const right = b?.[sortKey] ?? "";
    return String(left).localeCompare(String(right), undefined, { numeric: true }) * direction;
  });
  return copy;
}

export function paginateClients(rows, page, pageSize) {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * pageSize;
  return { rows: rows.slice(start, start + pageSize), page: current, pages, total };
}
