/** Split a stored PO number into prefix + numeric/suffix segment for the create form. */
export function splitPoNumber(fullNumber, knownPrefixes = []) {
  const num = String(fullNumber || "").trim();
  if (!num) return { prefix: "", suffix: "" };

  const sorted = [...knownPrefixes].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const prefix of sorted) {
    if (num.startsWith(prefix)) {
      return { prefix, suffix: num.slice(prefix.length) };
    }
  }

  const dashMatch = num.match(/^([A-Za-z]+-\d*)(.*)$/);
  if (dashMatch) {
    const core = dashMatch[1];
    const rest = dashMatch[2] || "";
    const digitTail = num.slice(core.length);
    if (/^\d+$/.test(digitTail)) {
      return { prefix: core.replace(/\d+$/, "") || core, suffix: digitTail };
    }
    return { prefix: core, suffix: rest };
  }

  const letterPrefix = num.match(/^([A-Za-z-]+)/);
  if (letterPrefix) {
    const prefix = letterPrefix[1];
    return { prefix, suffix: num.slice(prefix.length) };
  }

  return { prefix: "", suffix: num };
}

export function joinPoNumber(prefix, suffix) {
  const p = String(prefix || "");
  const s = String(suffix || "").trim();
  if (!p && !s) return "";
  if (!p) return s;
  if (!s) return p;
  return `${p}${s}`;
}

export function suggestClonedPoSuffix(suffix) {
  const raw = String(suffix || "").trim();
  if (!raw) return "1";
  const match = raw.match(/^(.*?)(\d+)$/);
  if (match) {
    const next = Number(match[2]) + 1;
    return `${match[1]}${next}`;
  }
  return `${raw}-COPY`;
}

export function newPoLineRow(overrides = {}) {
  return {
    _rowKey:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `row-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    item_id: null,
    item_description: "",
    hsn: "",
    qty: "",
    unit: "",
    rate: "",
    tax_type: "Exclusive",
    discount: "",
    discount_type: "₹",
    gst_pct: "",
    amount: 0,
    ...overrides,
  };
}
