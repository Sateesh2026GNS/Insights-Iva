/**
 * Indian 10-digit mobile validation (aligned with backend app.utils.indian_phone).
 */

export const PHONE_ERROR_KEYS = {
  digitsOnly: "validation.mobile.digitsOnly",
  tenDigits: "validation.mobile.tenDigits",
  startDigit: "validation.mobile.startDigit",
};

/** Backend ValueError / Pydantic messages → i18n keys */
const BACKEND_MSG_TO_KEY = {
  "use digits only.": PHONE_ERROR_KEYS.digitsOnly,
  "mobile number must be 10 digits.": PHONE_ERROR_KEYS.tenDigits,
  "mobile number must start with 6, 7, 8 or 9.": PHONE_ERROR_KEYS.startDigit,
};

const PYDANTIC_VALUE_ERROR_PREFIX = /^value error,\s*/i;

export function normalizeIndianMobileInput(value) {
  if (value == null) return "";
  let raw = String(value).trim();
  if (!raw) return "";
  raw = raw.replace(/[\s-]/g, "");
  if (raw.startsWith("+91")) raw = raw.slice(3);
  else if (raw.startsWith("91") && raw.length > 10) raw = raw.slice(2);
  return raw.replace(/\D/g, "").slice(0, 10);
}

function resolveErrorKey(digits) {
  if (digits.length !== 10) return PHONE_ERROR_KEYS.tenDigits;
  if (!/^[6-9]/.test(digits)) return PHONE_ERROR_KEYS.startDigit;
  return null;
}

/**
 * @param {string} value
 * @param {(key: string) => string} t i18n translate function
 * @param {{ required?: boolean }} [options]
 * @returns {{ ok: boolean, message: string, value?: string }}
 */
export function validateIndianMobile(value, t, options = {}) {
  const { required = false } = options;
  const translate = typeof t === "function" ? t : (key) => key;
  const raw = value == null ? "" : String(value).trim();

  if (!raw) {
    if (required) {
      return { ok: false, message: translate(PHONE_ERROR_KEYS.tenDigits) };
    }
    return { ok: true, message: "", value: "" };
  }

  const compact = raw.replace(/[\s-]/g, "");
  let digitPart = compact;
  if (digitPart.startsWith("+91")) digitPart = digitPart.slice(3);
  else if (digitPart.startsWith("91") && digitPart.length > 10) digitPart = digitPart.slice(2);

  const hadNonDigit = /[^\d+]/.test(compact) || (digitPart.length > 0 && /\D/.test(digitPart));
  if (hadNonDigit) {
    return { ok: false, message: translate(PHONE_ERROR_KEYS.digitsOnly) };
  }

  const digits = normalizeIndianMobileInput(raw);
  const key = resolveErrorKey(digits);
  if (key) {
    return { ok: false, message: translate(key) };
  }
  return { ok: true, message: "", value: digits };
}

/** Map FastAPI/Pydantic phone errors to localized strings when possible. */
export function translateBackendPhoneMessage(msg, t) {
  if (!msg || typeof msg !== "string") return msg;
  const stripped = msg.replace(PYDANTIC_VALUE_ERROR_PREFIX, "").trim();
  const key = BACKEND_MSG_TO_KEY[stripped.toLowerCase()];
  if (key && typeof t === "function") {
    return t(key);
  }
  return msg;
}
