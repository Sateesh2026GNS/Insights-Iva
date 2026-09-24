/**
 * Indian GSTIN validation — mirrors backend app.utils.gst.validate_gstin.
 */

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const GSTIN_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function normalizeGstin(value) {
  if (value == null) return null;
  const cleaned = String(value).replace(/\s+/g, "").trim().toUpperCase();
  return cleaned || null;
}

/**
 * @returns {string|null} normalized GSTIN
 * @throws {Error} when invalid or required but empty
 */
export function validateGstin(value, { required = false } = {}) {
  const gstin = normalizeGstin(value);
  if (!gstin) {
    if (required) throw new Error("GST Number is required");
    return null;
  }
  if (gstin.length !== 15) {
    throw new Error("GST Number must be exactly 15 characters");
  }
  if (!GSTIN_RE.test(gstin)) {
    throw new Error("Invalid GST Number format");
  }
  let total = 0;
  for (let i = 0; i < 14; i += 1) {
    const code = GSTIN_CHARS.indexOf(gstin[i]);
    const product = code * (i % 2 === 0 ? 1 : 2);
    total += Math.floor(product / 36) + (product % 36);
  }
  const check = (36 - (total % 36)) % 36;
  if (GSTIN_CHARS[check] !== gstin[14]) {
    throw new Error("Invalid GST Number checksum");
  }
  return gstin;
}

/** Field-level helper for forms. */
export function validateGstinField(value, { required = false } = {}) {
  try {
    const normalized = validateGstin(value, { required });
    return { ok: true, value: normalized };
  } catch {
    return { ok: false, error: "Enter a valid GSTIN." };
  }
}
