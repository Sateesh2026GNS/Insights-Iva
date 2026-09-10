/**
 * serverWakeup.js
 * Pings the backend /health endpoint on app start so that Render/Railway free-tier
 * instances wake up BEFORE the user tries to load data.
 * Shows a subtle "Connecting to server…" indicator if the server takes > 3 s.
 */
import axios from "axios";
import { getApiBaseURL } from "../api/axiosConfig";

let wakeupPromise = null;
let _notifyCallback = null;
let _resolveCallback = null;
let _wakeupDone = false;

/** Register callbacks for UI — called by App.jsx */
export function registerWakeupCallbacks(notify, resolve) {
  _notifyCallback = notify;
  _resolveCallback = resolve;
}

export function isWakeupDone() {
  return _wakeupDone;
}

/**
 * Initiates a background ping to the backend health endpoint.
 * Should be called once at app startup (before routes render data).
 */
export function triggerServerWakeup() {
  if (wakeupPromise) return wakeupPromise;

  const baseURL = getApiBaseURL();
  if (!baseURL) {
    _wakeupDone = true;
    return Promise.resolve();
  }

  let notifyTimer = null;

  wakeupPromise = (async () => {
    // If backend doesn't respond in 3 s, show a subtle "connecting" banner
    notifyTimer = setTimeout(() => {
      if (!_wakeupDone && typeof _notifyCallback === "function") {
        _notifyCallback("Connecting to server… Please wait a moment.");
      }
    }, 3000);

    const maxAttempts = 5;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await axios.get(`${baseURL}/health`, { timeout: 15_000 });
        _wakeupDone = true;
        clearTimeout(notifyTimer);
        if (typeof _resolveCallback === "function") _resolveCallback();
        return;
      } catch {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
        }
      }
    }
    // Even if health never responds, mark done so we don't block the UI forever
    _wakeupDone = true;
    clearTimeout(notifyTimer);
    if (typeof _resolveCallback === "function") _resolveCallback();
  })();

  return wakeupPromise;
}
