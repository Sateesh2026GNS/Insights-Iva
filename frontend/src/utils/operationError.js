/** User-facing operation-level error dialog copy (centered popup via ToastContext). */

export const OPERATION_ERROR_DUPLICATE_TITLE = "Unable to save";
export const OPERATION_ERROR_DUPLICATE_MESSAGE =
  "This record already exists. Please check and try again.";

const RAW_DETAIL_MARKERS = [
  /traceback/i,
  /sqlalchemy/i,
  /psycopg/i,
  /integrityerror/i,
  /uniqueviolation/i,
  /duplicate\s+key/i,
  /relation\s+"/i,
  /column\s+"/i,
  /operationalerror/i,
  /programmingerror/i,
];

const VALIDATION_TOAST_MESSAGE = "Enter valid inputs";

export function isHighlightedFieldsMessage(text) {
  const lower = String(text || "")
    .toLowerCase()
    .replace(/[.!?]+$/, "");
  return lower.includes("please fix") && lower.includes("highlighted field");
}

export function isValidationToastMessage(text) {
  const raw = String(text || "")
    .trim()
    .replace(/[.!?]+$/, "")
    .trim();
  if (!raw) return false;
  const lower = raw.toLowerCase();
  if (lower === VALIDATION_TOAST_MESSAGE.toLowerCase()) return true;
  return (
    isHighlightedFieldsMessage(raw) ||
    lower.includes("check the highlighted field") ||
    lower.includes("correct the highlighted field") ||
    lower.includes("validation failed") ||
    lower.includes("validation error")
  );
}

function looksLikeRawTechnicalMessage(text) {
  const raw = String(text || "").trim();
  if (!raw) return true;
  if (raw.length > 280) return true;
  return RAW_DETAIL_MARKERS.some((re) => re.test(raw));
}

function isDuplicateOrConflictMessage(text) {
  const lower = String(text || "").toLowerCase();
  return (
    lower.includes("already exists") ||
    lower.includes("record already exists") ||
    lower.includes("duplicate") ||
    lower.includes("conflicts with existing") ||
    lower.includes("email already in use") ||
    lower.includes("already in use")
  );
}

function inferOperationErrorTitle(message, status) {
  const lower = String(message || "").toLowerCase();
  if (
    lower.includes("delete") ||
    lower.includes("remove") ||
    lower.includes("deactivate") ||
    lower.includes("clear")
  ) {
    return "Unable to complete";
  }
  if (
    lower.includes("load") ||
    lower.includes("fetch") ||
    lower.includes("connect") ||
    status === 503
  ) {
    return "Unable to load";
  }
  return "Unable to save";
}

function sanitizeShortMessage(message, fallback) {
  const raw = String(message || "").trim();
  if (!raw || looksLikeRawTechnicalMessage(raw)) {
    return fallback;
  }
  if (raw.length > 160) {
    return fallback;
  }
  return raw;
}

/**
 * Map a toast/API message to centered operation-error dialog content.
 * Returns null when the message should stay a compact corner toast (validation hints).
 */
export function resolveOperationErrorDialog(message, options = {}) {
  const status = options.status;
  const raw = String(message || "").trim();
  if (!raw || isValidationToastMessage(raw)) {
    return null;
  }

  if (status === 409 || isDuplicateOrConflictMessage(raw)) {
    return {
      title: OPERATION_ERROR_DUPLICATE_TITLE,
      message: OPERATION_ERROR_DUPLICATE_MESSAGE,
    };
  }

  const title = inferOperationErrorTitle(raw, status);
  const fallback =
    title === "Unable to load"
      ? "Please try again in a moment."
      : "Something went wrong. Please try again.";
  const body = sanitizeShortMessage(raw, fallback);

  return { title, message: body };
}
