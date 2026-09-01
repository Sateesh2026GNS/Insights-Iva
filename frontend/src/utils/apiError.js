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

export function apiErrorMessage(err, fallback = "Something went wrong.") {
  const detail = err?.response?.data?.detail;
  if (detail != null && detail !== "") {
    return formatApiError(detail, fallback);
  }
  return err?.message || fallback;
}

/** User-friendly message for common HTTP status codes. */
export function httpStatusMessage(err, fallback = "Something went wrong.") {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
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

export function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
}
