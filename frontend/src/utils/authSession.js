/**
 * Browser session markers — not secrets. Auth tokens live in HttpOnly cookies only.
 */

export const SESSION_ACTIVE_KEY = "smrt-session-active";
const LEGACY_TOKEN_KEYS = ["smrt-token", "smrt-refresh-token"];

export function markBrowserSessionActive() {
  try {
    localStorage.setItem(SESSION_ACTIVE_KEY, "1");
    clearLegacyAuthTokens();
  } catch {}
}

export function clearBrowserSessionMarkers() {
  try {
    localStorage.removeItem(SESSION_ACTIVE_KEY);
    clearLegacyAuthTokens();
  } catch {}
}

export function clearLegacyAuthTokens() {
  try {
    for (const key of LEGACY_TOKEN_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {}
}

export function isBrowserSessionMarked() {
  try {
    return localStorage.getItem(SESSION_ACTIVE_KEY) === "1";
  } catch {
    return false;
  }
}

export function isFastOfflineSessionToken(token) {
  return typeof token === "string" && token.startsWith("fast-session-");
}
