import {
  formatDisplayDate,
  parseIsoDate,
  startOfMonth,
  toIsoDate,
  todayIso,
  validateDateRange,
} from "./dateUtils";

/** @typedef {{ id: string, label: string, from: string, to: string }} SalesDashboardPeriodPreset */

/** Sunday-start calendar week (local timezone). */
export function startOfWeekSunday(date = new Date()) {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

export function defaultSalesDashboardRange(now = new Date()) {
  return { from: toIsoDate(startOfMonth(now)), to: todayIso(now) };
}

function quarterStartMonth(now) {
  return Math.floor(now.getMonth() / 3) * 3;
}

/** Presets for the Sales Manager dashboard reporting period (dynamic, local calendar). */
export function buildSalesDashboardPeriodPresets(now = new Date()) {
  const today = todayIso(now);
  const yesterdayDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const yesterday = toIsoDate(yesterdayDate);

  const thisWeekStart = startOfWeekSunday(now);
  const lastWeekEnd = new Date(thisWeekStart);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 1);
  const lastWeekStart = startOfWeekSunday(lastWeekEnd);

  const monthStart = toIsoDate(startOfMonth(now));
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const qStartMonth = quarterStartMonth(now);
  const thisQStart = new Date(now.getFullYear(), qStartMonth, 1);
  const lastQStartMonth = qStartMonth - 3;
  const lastQYear = lastQStartMonth < 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastQStart = new Date(lastQYear, (lastQStartMonth + 12) % 12, 1);
  const lastQEnd = new Date(lastQYear, ((lastQStartMonth + 12) % 12) + 3, 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  return [
    { id: "today", label: "Today", from: today, to: today },
    { id: "yesterday", label: "Yesterday", from: yesterday, to: yesterday },
    { id: "this_week", label: "This Week", from: toIsoDate(thisWeekStart), to: today },
    {
      id: "last_week",
      label: "Last Week",
      from: toIsoDate(lastWeekStart),
      to: toIsoDate(lastWeekEnd),
    },
    { id: "this_month", label: "This Month", from: monthStart, to: today },
    {
      id: "last_month",
      label: "Last Month",
      from: toIsoDate(lastMonthStart),
      to: toIsoDate(lastMonthEnd),
    },
    { id: "this_quarter", label: "This Quarter", from: toIsoDate(thisQStart), to: today },
    {
      id: "last_quarter",
      label: "Last Quarter",
      from: toIsoDate(lastQStart),
      to: toIsoDate(lastQEnd),
    },
    { id: "this_year", label: "This Year", from: toIsoDate(yearStart), to: today },
  ];
}

export function findPresetByRange(presets, from, to) {
  const match = presets.find((p) => p.from === from && p.to === to);
  return match?.id || "custom";
}

/** Human-readable range label (matches hub period_label style). */
export function formatSalesPeriodRangeLabel(from, to) {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return "Selected period";
  if (from === to) {
    return start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  }
  if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
    const a = start.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const b = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    return `${a} – ${b}`;
  }
  const a = start.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  const b = end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  return `${a} – ${b}`;
}

export function formatSalesDashboardPeriodMeta(presetId, presets, from, to) {
  if (presetId && presetId !== "custom") {
    const preset = presets.find((p) => p.id === presetId);
    if (preset) return preset.label;
  }
  if (from && to) {
    const check = validateDateRange(from, to);
    if (check.valid) return formatSalesPeriodRangeLabel(from, to);
    return formatDisplayDate(from) && formatDisplayDate(to)
      ? `${formatDisplayDate(from)} – ${formatDisplayDate(to)}`
      : "Custom date";
  }
  return "Selected period";
}

export function salesDashboardRangeParams(from, to) {
  const check = validateDateRange(from, to);
  if (!check.valid || !from || !to) return null;
  return { from_date: from, to_date: to };
}
