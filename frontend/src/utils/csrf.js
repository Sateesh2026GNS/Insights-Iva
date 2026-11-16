/** CSRF token for double-submit (cookie on API host + matching header). */

let memoryToken = null;

export function setCsrfToken(token) {
  memoryToken = token ? String(token).trim() : null;
}

function readDocumentCsrfCookie() {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("iva_csrf=")) {
      return decodeURIComponent(part.slice("iva_csrf=".length));
    }
  }
  return null;
}

/**
 * Header must match the cookie the browser will send.
 * Same-origin (Vite proxy) can read `iva_csrf`. Cross-origin cannot, so use the
 * token returned in JSON by /auth/csrf or login.
 */
export function getCsrfTokenFromCookie() {
  const fromDocument = readDocumentCsrfCookie();
  if (fromDocument) return fromDocument;
  return memoryToken;
}
