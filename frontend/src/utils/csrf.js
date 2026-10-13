/** CSRF token for double-submit (cookie on API host + matching header). */

let memoryToken = null;

export function setCsrfToken(token) {
  memoryToken = token ? String(token).trim() : null;
}

/** Prefer in-memory token (from /auth/csrf JSON); fall back to cookie on same site. */
export function getCsrfTokenFromCookie() {
  if (memoryToken) return memoryToken;
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("iva_csrf=")) {
      return decodeURIComponent(part.slice("iva_csrf=".length));
    }
  }
  return null;
}
