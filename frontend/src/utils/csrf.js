/** Read double-submit CSRF token from document cookie (not HttpOnly). */

export function getCsrfTokenFromCookie() {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (part.startsWith("iva_csrf=")) {
      return decodeURIComponent(part.slice("iva_csrf=".length));
    }
  }
  return null;
}
