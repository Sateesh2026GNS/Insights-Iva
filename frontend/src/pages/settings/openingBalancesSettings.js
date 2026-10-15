/** Opening balance date helpers (Indian FY default: 1 April). */

export const OPENING_BALANCE_SETTING_KEY = "opening_balance_date";

export function indianFyStartIso(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1;
  return `${startYear}-04-01`;
}

export function isoToDisplayDate(iso) {
  if (!iso) return "";
  const [y, m, d] = String(iso).split("-");
  if (!y || !m || !d) return "";
  return `${d}/${m}/${y}`;
}

export function parseStoredOpeningBalanceDate(value, fallbackIso) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (value && typeof value === "object") {
    const raw = value.opening_balance_date || value.date || "";
    if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  }
  return fallbackIso;
}

export function unwrapFeatureSettingValue(res) {
  const body = res?.data;
  if (body && typeof body === "object" && "success" in body && "data" in body) {
    return body.data?.value;
  }
  return body?.value;
}
