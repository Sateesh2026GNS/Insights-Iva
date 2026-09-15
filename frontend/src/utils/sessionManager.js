/**
 * Session Lifecycle & Multi-Tab Manager
 *
 * Requirements:
 * 1. Primary login session: expires automatically after 9 hours (32,400,000 ms).
 * 2. New tab opened with deployed URL: expires automatically after 10 minutes (600,000 ms).
 * 3. Primary tab keeps running its 9-hour session even if a new tab expires.
 * 4. If primary tab is closed, an expiring new tab performs a full session logout.
 */

export const PRIMARY_SESSION_TIMEOUT_MS = 9 * 60 * 60 * 1000; // 9 hours
export const NEW_TAB_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const HEARTBEAT_WINDOW_MS = 6000; // Primary tab heartbeat validity

/**
 * Generate or retrieve unique tab ID for this browser tab.
 */
export function getTabId() {
  try {
    let id = sessionStorage.getItem("smrt-tab-id");
    if (!id) {
      id = "tab_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem("smrt-tab-id", id);
    }
    return id;
  } catch {
    return "tab_fallback";
  }
}

/**
 * Check whether this tab is the primary login tab or a new tab.
 * Uses window.name + sessionStorage + localStorage to guarantee accurate detection
 * across new tabs, duplicated tabs, and page reloads.
 */
export function getTabType() {
  try {
    const tabType = sessionStorage.getItem("smrt-tab-type");
    const primaryWin = localStorage.getItem("smrt-primary-window-name");
    const primaryTabId = localStorage.getItem("smrt-primary-tab-id");
    const myTabId = getTabId();

    if (
      tabType === "primary" &&
      window.name &&
      window.name === primaryWin &&
      myTabId === primaryTabId
    ) {
      return "primary";
    }
    return "new_tab";
  } catch {
    return "new_tab";
  }
}

/**
 * Called on user login: promotes the current tab to the primary login tab
 * and starts the 9-hour timer.
 */
export function markAsPrimaryTab() {
  try {
    const tabId = getTabId();
    const winName = "smrt-primary-" + tabId;
    window.name = winName;

    const now = Date.now();
    sessionStorage.setItem("smrt-tab-type", "primary");
    sessionStorage.setItem("smrt-tab-id", tabId);
    sessionStorage.removeItem("smrt-new-tab-opened-at");
    sessionStorage.removeItem("smrt-tab-expired");

    localStorage.setItem("smrt-primary-window-name", winName);
    localStorage.setItem("smrt-primary-tab-id", tabId);
    localStorage.setItem("smrt-login-time", String(now));
    localStorage.setItem("smrt-primary-heartbeat", String(now));
  } catch {}
}

/**
 * Called when a tab boots up / renders.
 * If this tab is not the primary tab and user has a token, initialize the 10-minute timer.
 */
export function initTabSession() {
  try {
    const token = localStorage.getItem("smrt-token");
    if (!token) return;

    const tabType = getTabType();
    if (tabType === "primary") {
      // Refresh heartbeat
      sendPrimaryHeartbeat();
      return;
    }

    // It's a new tab
    const myTabId = getTabId();
    if (!window.name || window.name.startsWith("smrt-primary-")) {
      window.name = "smrt-new-tab-" + myTabId;
    }
    sessionStorage.setItem("smrt-tab-type", "new_tab");

    if (!sessionStorage.getItem("smrt-new-tab-opened-at")) {
      sessionStorage.setItem("smrt-new-tab-opened-at", String(Date.now()));
    }
  } catch {}
}

/**
 * Send heartbeat from primary tab to indicate it is still open and active.
 */
export function sendPrimaryHeartbeat() {
  try {
    localStorage.setItem("smrt-primary-heartbeat", String(Date.now()));
  } catch {}
}

/**
 * Check if the primary tab is currently open and sending heartbeats.
 */
export function isPrimaryTabAlive() {
  try {
    const hb = Number(localStorage.getItem("smrt-primary-heartbeat") || 0);
    return hb > 0 && Date.now() - hb < HEARTBEAT_WINDOW_MS;
  } catch {
    return false;
  }
}

/**
 * Check if the current session has expired.
 * Returns { expired: boolean, reason: string | null }
 */
export function checkSessionStatus() {
  try {
    const token = localStorage.getItem("smrt-token");
    if (!token) return { expired: false, reason: null };

    // Check if this tab is specifically marked expired
    if (sessionStorage.getItem("smrt-tab-expired") === "true") {
      const reason = sessionStorage.getItem("smrt-tab-expired-reason") || "new_tab_10min_timeout";
      return { expired: true, reason };
    }

    // 1. Overall 9-hour limit from login
    const loginTime = Number(localStorage.getItem("smrt-login-time") || 0);
    if (loginTime > 0 && Date.now() - loginTime >= PRIMARY_SESSION_TIMEOUT_MS) {
      return { expired: true, reason: "primary_9hr_timeout" };
    }

    // 2. 10-minute limit if this is a new tab
    if (getTabType() === "new_tab") {
      const openedAt = Number(sessionStorage.getItem("smrt-new-tab-opened-at") || 0);
      if (openedAt > 0 && Date.now() - openedAt >= NEW_TAB_TIMEOUT_MS) {
        return { expired: true, reason: "new_tab_10min_timeout" };
      }
    }

    return { expired: false, reason: null };
  } catch {
    return { expired: false, reason: null };
  }
}

/**
 * Mark this specific tab as expired.
 */
export function markTabExpired(reason = "new_tab_10min_timeout") {
  try {
    sessionStorage.setItem("smrt-tab-expired", "true");
    sessionStorage.setItem("smrt-tab-expired-reason", reason);
  } catch {}
}

/**
 * Get the reason for session expiry if expired.
 */
export function getSessionExpiryReason() {
  try {
    const status = checkSessionStatus();
    if (status.expired) return status.reason;
    return sessionStorage.getItem("smrt-tab-expired-reason") || null;
  } catch {
    return null;
  }
}

/**
 * Clean up tab session data on logout.
 */
export function clearTabSession() {
  try {
    sessionStorage.removeItem("smrt-tab-type");
    sessionStorage.removeItem("smrt-tab-id");
    sessionStorage.removeItem("smrt-new-tab-opened-at");
    sessionStorage.removeItem("smrt-tab-expired");
    sessionStorage.removeItem("smrt-tab-expired-reason");

    const primaryTabId = localStorage.getItem("smrt-primary-tab-id");
    const myTabId = sessionStorage.getItem("smrt-tab-id");
    if (!primaryTabId || primaryTabId === myTabId) {
      localStorage.removeItem("smrt-primary-window-name");
      localStorage.removeItem("smrt-primary-tab-id");
      localStorage.removeItem("smrt-primary-heartbeat");
      localStorage.removeItem("smrt-login-time");
    }
  } catch {}
}
