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

export function asArray(data) {
  if (Array.isArray(data)) return data;
  if (data && typeof data === "object") {
    if (Array.isArray(data.items)) return data.items;
    if (Array.isArray(data.results)) return data.results;
    if (Array.isArray(data.data)) return data.data;
  }
  return [];
}
