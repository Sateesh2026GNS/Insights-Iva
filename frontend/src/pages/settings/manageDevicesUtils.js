export function formatSessionTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deviceIconKind(deviceType) {
  const t = String(deviceType || "").toLowerCase();
  if (t === "mobile") return "mobile";
  if (t === "tablet") return "tablet";
  return "desktop";
}

export function partitionSessions(payload) {
  const current = payload?.current || null;
  const others = Array.isArray(payload?.others) ? payload.others : [];
  return { current, others, total: payload?.total_active ?? (current ? 1 : 0) + others.length };
}
