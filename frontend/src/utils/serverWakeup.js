/**
 * serverWakeup.js
 * Proactively wakes sleeping backend instances (e.g. Render / Railway free tier)
 * and keeps them alive with a periodic background heartbeat ping.
 */
import axios from "axios";
import { getApiBaseURL } from "../api/axiosConfig";

let wakeupPromise = null;
let keepAliveTimer = null;
let serverIsAwake = false;

export function isServerWakeupOrTransientError(err) {
  if (!err) return false;
  const status = err?.response?.status;
  if (status === 502 || status === 503 || status === 504) return true;
  const code = String(err?.code || "");
  const message = String(err?.message || "").toLowerCase();
  return (
    code === "ECONNABORTED" ||
    code === "ERR_NETWORK" ||
    message.includes("timeout") ||
    message.includes("network error") ||
    message.includes("econnreset") ||
    message.includes("err_connection_reset") ||
    message.includes("failed to fetch")
  );
}

export function isServerAwake() {
  return serverIsAwake;
}

/**
 * Actively ping /health until the server answers with 200 OK.
 * Uses rapid 10s timeouts with 2.5s intervals so cold start is caught immediately.
 */
export function triggerServerWakeup({ force = false } = {}) {
  if (serverIsAwake && !force) return Promise.resolve(true);
  if (wakeupPromise && !force) return wakeupPromise;

  const baseURL = getApiBaseURL();
  const healthUrl = baseURL ? `${baseURL}/health` : "/health";

  wakeupPromise = (async () => {
    const maxAttempts = 12; // 12 attempts * ~3-10s = up to ~90s total window
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await axios.get(healthUrl, {
          timeout: 12_000,
          headers: { "Cache-Control": "no-cache" },
        });
        if (res.status === 200) {
          serverIsAwake = true;
          wakeupPromise = null;
          return true;
        }
      } catch {
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 2500));
        }
      }
    }
    wakeupPromise = null;
    return false;
  })();

  return wakeupPromise;
}

/**
 * Periodically pings /health every 8 minutes while the tab is open to prevent
 * Render instances from spinning down after 15 minutes of inactivity.
 */
export function startServerKeepAlive(intervalMinutes = 8) {
  if (typeof window === "undefined") return;
  if (keepAliveTimer) return;

  // Initial trigger immediately
  triggerServerWakeup();

  const intervalMs = intervalMinutes * 60 * 1000;
  keepAliveTimer = setInterval(() => {
    const baseURL = getApiBaseURL();
    const healthUrl = baseURL ? `${baseURL}/health` : "/health";
    axios
      .get(healthUrl, {
        timeout: 15_000,
        headers: { "Cache-Control": "no-cache" },
      })
      .then(() => {
        serverIsAwake = true;
      })
      .catch(() => {
        serverIsAwake = false;
        triggerServerWakeup({ force: true });
      });
  }, intervalMs);
}

export function stopServerKeepAlive() {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }
}
