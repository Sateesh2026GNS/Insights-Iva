/**
 * Indian GSTIN validation:
 * Exactly 15 alphanumeric characters with at least one letter and one number.
 */

const GSTIN_RE = /^(?=.*[0-9])(?=.*[A-Z])[A-Z0-9]{15}$/;

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
    throw new Error("GST Number must contain at least one letter and one number");
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
