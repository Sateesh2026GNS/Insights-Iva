/**
 * serverWakeup.js
 * Silently pings the backend /health endpoint on app start in the background.
 */
import axios from "axios";
import { getApiBaseURL } from "../api/axiosConfig";

let wakeupPromise = null;

export function triggerServerWakeup() {
  if (wakeupPromise) return wakeupPromise;

  const baseURL = getApiBaseURL();
  if (!baseURL) return Promise.resolve();

  wakeupPromise = (async () => {
    try {
      await axios.get(`${baseURL}/health`, { timeout: 10_000 });
    } catch {
      // Ignore background warmup errors silently
    }
  })();

  return wakeupPromise;
}
