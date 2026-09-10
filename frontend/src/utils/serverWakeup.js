/**
 * serverWakeup.js
 * Silently pings the backend /health endpoint on app start in the background.
 * Retries up to 3 times to wake a sleeping Render/Railway free-tier instance.
 */
import axios from "axios";
import { getApiBaseURL } from "../api/axiosConfig";

let wakeupPromise = null;

export function triggerServerWakeup() {
  if (wakeupPromise) return wakeupPromise;

  const baseURL = getApiBaseURL();
  if (!baseURL) return Promise.resolve();

  wakeupPromise = (async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await axios.get(`${baseURL}/health`, { timeout: 30_000 });
        return; // server is up
      } catch {
        if (attempt < 3) {
          await new Promise((r) => setTimeout(r, 5000)); // wait 5 s between pings
        }
      }
    }
  })();

  return wakeupPromise;
}
