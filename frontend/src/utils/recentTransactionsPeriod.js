import {
  daysInMonth,
  formatMediumDate,
  fyRange,
  startOfMonth,
  toIsoDate,
  todayIso,
  validateDateRange,
} from "./dateUtils";

export const PERIOD_RECENT = "recent_transactions";
export const PERIOD_CUSTOM = "custom_date";
export const PERIOD_CURRENT_FY = "current_fy";
export const PERIOD_PREVIOUS_FY = "previous_fy";

const MONTH_ID_PREFIX = "month:";

/** Rolling last six calendar months (current month first), Indian FY presets, custom. */
export function buildRecentTransactionsPeriodOptions(now = new Date()) {
  const today = todayIso(now);
  const options = [{ id: PERIOD_RECENT, label: "Recent Transactions" }];

  for (let i = 0; i < 6; i += 1) {
    const monthStart = startOfMonth(new Date(now.getFullYear(), now.getMonth() - i, 1));
    const y = monthStart.getFullYear();
    const m = monthStart.getMonth();
    const from = toIsoDate(monthStart);
    const to = `${y}-${String(m + 1).padStart(2, "0")}-${String(daysInMonth(y, m)).padStart(2, "0")}`;
    const label = monthStart.toLocaleString("en-IN", { month: "long", year: "numeric" });
    options.push({ id: `${MONTH_ID_PREFIX}${from}`, label, from, to });
  }

  const fy = fyRange(now);
  const fyStartYear = Number(fy.from.slice(0, 4));
  const prevFrom = `${fyStartYear - 1}-04-01`;
  const prevTo = `${fyStartYear}-03-31`;

  options.push({
    id: PERIOD_CURRENT_FY,
    label: "Current Financial Year",
    from: fy.from,
    to: today < fy.to ? today : fy.to,
  });
  options.push({
    id: PERIOD_PREVIOUS_FY,
    label: "Previous Financial Year",
    from: prevFrom,
    to: prevTo,
  });
  options.push({ id: PERIOD_CUSTOM, label: "Custom Date" });

  return options;
}

export function formatCustomPeriodRangeLabel(from, to) {
  if (!from || !to) return "Custom Date";
  return `${formatMediumDate(from)} — ${formatMediumDate(to)}`;
}

export function resolveRecentTransactionsPeriod(periodId, options, customRange = null) {
  if (periodId === PERIOD_CUSTOM && customRange?.from && customRange?.to) {
    return { from: customRange.from, to: customRange.to };
  }
  if (periodId === PERIOD_RECENT) {
    const to = todayIso();
    const from = toIsoDate(new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 30));
    return { from, to };
  }
  const match = options.find((o) => o.id === periodId);
  if (match?.from && match?.to) return { from: match.from, to: match.to };
  return resolveRecentTransactionsPeriod(PERIOD_RECENT, options);
}

export function periodOptionLabel(periodId, options, customRange) {
  if (periodId === PERIOD_CUSTOM && customRange?.from && customRange?.to) {
    return formatCustomPeriodRangeLabel(customRange.from, customRange.to);
  }
  return options.find((o) => o.id === periodId)?.label || "Recent Transactions";
}

export function validateCustomPeriodRange(from, to) {
  if (!from || !to) {
    return { valid: false, message: "From Date and To Date are required." };
  }
  return validateDateRange(from, to);
}
