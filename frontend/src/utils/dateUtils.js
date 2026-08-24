/**
 * Insights Iva — timezone-safe date utilities (India / calendar dates).
 * API format: YYYY-MM-DD (ISO date string, no time component).
 * Display format: DD/MM/YYYY by default.
 *
 * Avoid `new Date("YYYY-MM-DD")` — parsed as UTC and can shift the calendar day.
 * Avoid `toISOString().slice(0, 10)` for "today" — uses UTC, not local (IST).
 */

export const API_DATE_FORMAT = "YYYY-MM-DD";
export const DISPLAY_DATE_FORMAT = "DD/MM/YYYY";
export const DEFAULT_TIMEZONE = "Asia/Kolkata";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Local calendar date → `YYYY-MM-DD` for API / PostgreSQL. */
export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Today's date in local timezone as `YYYY-MM-DD`. */
export function todayIso(date = new Date()) {
  return toIsoDate(date);
}

/** Local date n days ago as `YYYY-MM-DD`. */
export function daysAgoIso(n, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() - n);
  return toIsoDate(d);
}

/** Local date n days from iso string. */
export function addDaysIso(iso, n) {
  const d = parseIsoDate(iso);
  if (!d) return "";
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

/**
 * Parse `YYYY-MM-DD` as local midnight (no UTC shift).
 * @returns {Date|null}
 */
export function parseIsoDate(iso) {
  if (!iso || typeof iso !== "string") return null;
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

/** Compare two ISO date strings. Returns -1, 0, or 1. */
export function compareIsoDates(a, b) {
  if (a === b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a < b ? -1 : 1;
}

/** `YYYY-MM-DD` → display string (default DD/MM/YYYY). */
export function formatDisplayDate(iso, separator = "/") {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  if (!y || !m || !d) return iso;
  return `${d}${separator}${m}${separator}${y}`;
}

/** Parse display DD/MM/YYYY or DD-MM-YYYY → `YYYY-MM-DD`. Returns "" if invalid. */
export function parseDisplayDate(str) {
  if (!str || typeof str !== "string") return "";
  const cleaned = str.trim();
  const m = cleaned.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!m) return "";
  const day = Number(m[1]);
  const month = Number(m[2]);
  const year = Number(m[3]);
  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  return parseIsoDate(iso) ? iso : "";
}

/** Default filter range: last month → today (local). */
export function defaultDateRange(monthsBack = 1) {
  const to = new Date();
  const from = new Date(to.getFullYear(), to.getMonth() - monthsBack, to.getDate());
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

/** Indian fiscal year Apr–Mar for a given date. */
export function fyRange(forDate = new Date()) {
  const y = forDate.getFullYear();
  const m = forDate.getMonth();
  const startY = m >= 3 ? y : y - 1;
  return {
    from: `${startY}-04-01`,
    to: `${startY + 1}-03-31`,
  };
}

export function validateDateRange(from, to) {
  if (!from || !to) return { valid: true, message: "" };
  if (from > to) {
    return { valid: false, message: "Start date cannot be after end date." };
  }
  return { valid: true, message: "" };
}

export function isIsoDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.trim());
}

/** Date → `datetime-local` input value (local, no timezone shift). */
export function toDatetimeLocalValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
  return `${toIsoDate(date)}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/** `datetime-local` string → Date (local). */
export function fromDatetimeLocalValue(value) {
  if (!value || typeof value !== "string") return null;
  const [datePart, timePart] = value.split("T");
  if (!datePart) return null;
  const d = parseIsoDate(datePart);
  if (!d || !timePart) return d;
  const [h, mi] = timePart.split(":").map(Number);
  d.setHours(h || 0, mi || 0, 0, 0);
  return d;
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date, n) {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

export function daysInMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** Open native date/datetime picker safely. */
export function openNativeDatePicker(inputEl) {
  if (!inputEl) return;
  try {
    if (typeof inputEl.showPicker === "function") {
      inputEl.showPicker();
    } else {
      inputEl.focus();
      inputEl.click();
    }
  } catch {
    inputEl.focus();
  }
}

/** Standard date-range presets (Indian FY aware). */
export function buildDateRangePresets(now = new Date()) {
  const today = toIsoDate(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const fyNow = fyRange(now);
  const fyPrevStart = Number(fyNow.from.slice(0, 4)) - 1;

  return [
    { id: "Today", from: today, to: today },
    { id: "This week", from: toIsoDate(weekStart), to: today },
    { id: "This month", from: toIsoDate(monthStart), to: today },
    { id: "This year", from: toIsoDate(yearStart), to: today },
    { id: "Yesterday", from: toIsoDate(yest), to: toIsoDate(yest) },
    { id: "Last week", from: toIsoDate(lastWeekStart), to: today },
    { id: "Last month", from: toIsoDate(lastMonthStart), to: toIsoDate(lastMonthEnd) },
    {
      id: `FY ${String(fyPrevStart).slice(2)}-${String(fyPrevStart + 1).slice(2)}`,
      from: `${fyPrevStart}-04-01`,
      to: `${fyPrevStart + 1}-03-31`,
    },
    {
      id: `FY ${String(fyPrevStart + 1).slice(2)}-${String(fyPrevStart + 2).slice(2)}`,
      from: fyNow.from,
      to: fyNow.to,
    },
  ];
}

/** Accounts restore-deleted / extended presets (includes last quarter + all time). */
export function buildAccountsDateRangePresets(now = new Date()) {
  const today = toIsoDate(now);
  const yest = new Date(now);
  yest.setDate(yest.getDate() - 1);
  const lastWeekStart = new Date(now);
  lastWeekStart.setDate(lastWeekStart.getDate() - 6);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const q = Math.floor(now.getMonth() / 3);
  const lastQStartMonth = ((q - 1 + 4) % 4) * 3;
  const lastQYear = q === 0 ? now.getFullYear() - 1 : now.getFullYear();
  const lastQStart = new Date(lastQYear, lastQStartMonth, 1);
  const lastQEnd = new Date(lastQYear, lastQStartMonth + 3, 0);
  const fyNow = fyRange(now);
  const fyPrevStart = Number(fyNow.from.slice(0, 4)) - 1;

  return [
    { id: "Today", from: today, to: today },
    { id: "Yesterday", from: toIsoDate(yest), to: toIsoDate(yest) },
    { id: "Last week", from: toIsoDate(lastWeekStart), to: today },
    { id: "Last month", from: toIsoDate(lastMonthStart), to: toIsoDate(lastMonthEnd) },
    { id: "Last quarter", from: toIsoDate(lastQStart), to: toIsoDate(lastQEnd) },
    {
      id: `FY ${String(fyPrevStart).slice(2)}-${String(fyPrevStart + 1).slice(2)}`,
      from: `${fyPrevStart}-04-01`,
      to: `${fyPrevStart + 1}-03-31`,
    },
    {
      id: `FY ${String(fyPrevStart + 1).slice(2)}-${String(fyPrevStart + 2).slice(2)}`,
      from: fyNow.from,
      to: fyNow.to,
    },
    { id: "All Time", from: "2000-01-01", to: today },
  ];
}
