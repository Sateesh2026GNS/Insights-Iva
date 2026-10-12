/**
 * Browser session markers and client auth token management.
 * Dual mode: Supports Bearer tokens in headers + HttpOnly cookies.
 */

export const SESSION_ACTIVE_KEY = "smrt-session-active";
export const AUTH_TOKEN_KEY = "smrt-token";
export const REFRESH_TOKEN_KEY = "smrt-refresh-token";

export function setStoredTokens(accessToken, refreshToken) {
  try {
    if (accessToken) {
      localStorage.setItem(AUTH_TOKEN_KEY, String(accessToken));
    }
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, String(refreshToken));
    }
  } catch {}
}

export function getStoredAccessToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function getStoredRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

export function clearAuthTokens() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {}
}

export function markBrowserSessionActive() {
  try {
    localStorage.setItem(SESSION_ACTIVE_KEY, "1");
  } catch {}
}

export function clearBrowserSessionMarkers() {
  try {
    localStorage.removeItem(SESSION_ACTIVE_KEY);
    clearAuthTokens();
  } catch {}
}

export function clearLegacyAuthTokens() {
  clearAuthTokens();
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
