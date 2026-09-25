/** Normalize FastAPI / Axios error payloads for toast and form display. */
export function formatApiError(detail, fallback = "Something went wrong.") {
  if (detail == null || detail === "") return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const parts = detail.map((item) => {
      if (typeof item === "string") return item;
      const loc = Array.isArray(item?.loc)
        ? item.loc.filter((p) => p !== "body" && p !== "query" && p !== "path").join(".")
        : "";
      const msg = item?.msg || item?.message || JSON.stringify(item);
      return loc ? `${loc}: ${msg}` : msg;
    });
    return parts.filter(Boolean).join(" · ") || fallback;
  }
  if (typeof detail === "object") {
    if (typeof detail.msg === "string") return detail.msg;
    if (typeof detail.message === "string") return detail.message;
    if (typeof detail.detail === "string") return detail.detail;
    try {
      return JSON.stringify(detail);
    } catch {
      return fallback;
    }
  }
  return fallback;
}

/** Read error payload from FastAPI detail or standard API envelope. */
export function extractApiErrorDetail(err) {
  const data = err?.response?.data;
  if (!data) return null;
  if (data.detail != null && data.detail !== "") return data.detail;
  if (Array.isArray(data.errors) && data.errors.length) return data.errors;
  if (data.data && typeof data.data === "object") {
    const nested = data.data;
    if (nested.message || nested.code || nested.blockers) return nested;
  }
  if (data.message && data.message !== "Validation failed") return data.message;
  if (data.message) return data.message;
  return null;
}

export function apiErrorMessage(err, fallback = "Something went wrong.") {
  const detail = extractApiErrorDetail(err);
  if (detail != null && detail !== "") {
    return formatApiError(detail, fallback);
  }
  const status = err?.response?.status;
  if (status === 409) {
    return "This action conflicts with the current state. Please refresh and try again.";
  }
  return err?.message || fallback;
}

/** User-friendly message for common HTTP status codes. */
export function httpStatusMessage(err, fallback = "Something went wrong.") {
  const status = err?.response?.status;
  const detail = extractApiErrorDetail(err);
  if (detail != null && detail !== "") {
    return formatApiError(detail, fallback);
  }
  if (status === 401) {
    return "Your session has expired. Please log in again.";
  }
  if (status === 403) {
    return "You don't have permission to perform this action.";
  }
  if (status === 404) {
    return "Requested record was not found.";
  }
  if (status === 409) {
    return "This action conflicts with the current state. Please refresh and try again.";
  }
  if (status === 422) {
    return "Please check your input and try again.";
  }
  if (status === 429) {
    const retryAfter = err?.response?.headers?.["retry-after"];
    const seconds = retryAfter ? parseInt(String(retryAfter), 10) : NaN;
    if (Number.isFinite(seconds) && seconds > 0) {
      return `Too many requests. Please wait ${seconds} second${seconds === 1 ? "" : "s"} and try again.`;
    }
    return "Too many requests. Please wait a moment and try again.";
  }
  if (status && status >= 500) {
    return "Something went wrong. Please try again.";
  }
  if (err?.code === "ERR_NETWORK") {
    return "Unable to connect. Please check your internet connection.";
  }
  if (err?.code === "ECONNABORTED") {
    return "The request timed out. Please try again.";
  }
  return err?.message || fallback;
}

const EMAIL_SERVICE_LEAK_PATTERN =
  /backend\/\.env|set\s+SMTP_|missing_settings=/i;

const REPORT_EMAIL_CODE_MESSAGES = {
  smtp_not_configured:
    "Email service is not configured. Please contact your administrator.",
  smtp_auth_failed: "Email service is temporarily unavailable. Please try again later.",
  smtp_connection_failed: "Email service is temporarily unavailable. Please try again later.",
  smtp_send_failed: "Email service is temporarily unavailable. Please try again later.",
};

function reportEmailDetailMessage(detail, fallback) {
  if (detail == null || detail === "") return null;
  if (typeof detail === "object" && !Array.isArray(detail)) {
    const code = detail.code;
    if (code && REPORT_EMAIL_CODE_MESSAGES[code]) {
      return REPORT_EMAIL_CODE_MESSAGES[code];
    }
    const message = detail.message;
    if (typeof message === "string" && message.trim()) {
      if (EMAIL_SERVICE_LEAK_PATTERN.test(message)) {
        return REPORT_EMAIL_CODE_MESSAGES.smtp_not_configured;
      }
      return message;
    }
  }
  const text = formatApiError(detail, fallback);
  if (!text) return null;
  if (EMAIL_SERVICE_LEAK_PATTERN.test(text)) {
    return REPORT_EMAIL_CODE_MESSAGES.smtp_not_configured;
  }
  return text;
}

/** User-facing errors for dashboard/ledger report email (PDF). */
export function reportEmailErrorMessage(err, fallback = "Unable to send the report. Please try again.") {
  const status = err?.response?.status;
  const detail = extractApiErrorDetail(err);
  if (status === 404) {
    return "Report email service is currently unavailable.";
  }
  if (status === 403) {
    return "You don't have permission to email this report.";
  }
  if (status === 422) {
    return reportEmailDetailMessage(detail, "Please check the email details.")
      || "Please check the email details.";
  }
  if (status === 503) {
    return (
      reportEmailDetailMessage(detail, fallback)
      || "Email service is temporarily unavailable. Please try again later."
    );
  }
  if (detail != null && detail !== "") {
    const mapped = reportEmailDetailMessage(detail, fallback);
    if (mapped) return mapped;
  }
  if (status && status >= 500) {
    return "Unable to send the report right now. Please try again.";
  }
  if (err?.code === "ERR_NETWORK" || err?.code === "ECONNABORTED") {
    return httpStatusMessage(err, fallback);
  }
  if (err?.message && !/^Request failed with status code \d+$/i.test(err.message)) {
    return err.message;
  }
  return fallback;
}

export function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
}

/** True when the request failed due to connectivity (not a server response). */
export function isNetworkError(err) {
  if (!err) return false;
  if (err?.response) return false;
  // If browser reports it is offline, it is definitely a network error
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return true;
  }
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return (
    code === "ERR_NETWORK" ||
    message.includes("Network Error") ||
    message.includes("ERR_CONNECTION_RESET") ||
    message.includes("ECONNRESET")
  );
}

export function isPermissionError(err) {
  return err?.response?.status === 403;
}

export function isAuthError(err) {
  return err?.response?.status === 401;
}

export function isConflictError(err) {
  return err?.response?.status === 409;
}

/** User-facing copy for 409 responses with optional server detail. */
export function conflictErrorMessage(err, fallback) {
  const detail = extractApiErrorDetail(err);
  if (detail != null && detail !== "") {
    return formatApiError(
      detail,
      fallback || "Someone else updated this record. Please refresh and try again.",
    );
  }
  return (
    fallback ||
    "Someone else updated this record. Your screen may contain older information."
  );
}

export function isValidationError(err) {
  const status = err?.response?.status;
  return status === 400 || status === 422;
}

/** Map FastAPI validation array to { fieldName: message }. */
export function mapValidationErrorsToFields(err) {
  const detail = extractApiErrorDetail(err);
  const fields = {};
  if (!Array.isArray(detail)) return fields;
  detail.forEach((item) => {
    const loc = Array.isArray(item?.loc)
      ? item.loc.filter((p) => p !== "body" && p !== "query" && p !== "path")
      : [];
    const key = loc.length ? loc[loc.length - 1] : "form";
    const msg = item?.msg || item?.message || "Invalid value";
    if (!fields[key]) fields[key] = msg;
  });
  return fields;
}

/**
 * Classify an API error for UI state routing.
 * Types: session | permission | conflict | validation | network | server | not_found | unknown
 */
export function classifyApiError(err, fallback = "Something went wrong.") {
  const message = httpStatusMessage(err, fallback);
  const status = err?.response?.status;

  if (status === 401) return { type: "session", message, fields: {} };
  if (status === 403) return { type: "permission", message, fields: {} };
  if (status === 409) return { type: "conflict", message, fields: {} };
  if (status === 400 || status === 422) {
    return {
      type: "validation",
      message,
      fields: mapValidationErrorsToFields(err),
    };
  }
  if (status === 404) return { type: "not_found", message, fields: {} };
  if (status === 429) return { type: "rate_limit", message, fields: {} };
  const isActuallyOffline = typeof navigator !== "undefined" && !navigator.onLine;
  if (isActuallyOffline) {
    return {
      type: "network",
      message: "Please check your internet connection and try again.",
      fields: {},
    };
  }
  if (isNetworkError(err)) {
    return {
      type: "server",
      message: "Unable to connect to server. Please try again.",
      fields: {},
    };
  }
  if (err?.code === "ECONNABORTED" || String(err?.message || "").includes("timeout")) {
    return {
      type: "server",
      message: "Server response timed out. Please try again.",
      fields: {},
    };
  }
  if (status && status >= 500) {
    return { type: "server", message: "Unable to load the data. Please try again.", fields: {} };
  }
  return { type: "unknown", message, fields: {} };
}

/** Merge backend field errors into an existing client-side errors object. */
export function applyBackendFieldErrors(err, setFieldErrors, fieldMap = {}) {
  const { fields } = classifyApiError(err);
  if (!fields || !Object.keys(fields).length) return false;
  const mapped = {};
  Object.entries(fields).forEach(([key, msg]) => {
    const target = fieldMap[key] || key;
    mapped[target] = msg;
  });
  setFieldErrors((prev) => ({ ...prev, ...mapped }));
  return true;
}
