export function isTransientNetworkError(err) {
  if (err?.response) return false;
  const code = String(err?.code || "");
  const message = String(err?.message || "");
  return (
    code === "ERR_NETWORK" ||
    code === "ECONNABORTED" ||
    message.includes("Network Error") ||
    message.includes("ERR_CONNECTION_RESET") ||
    message.includes("ECONNRESET")
  );
}

/** Retry when the backend restarts mid-request (common during dev hot reload). */
export async function withTransientRetry(fn, { attempts = 3, baseDelayMs = 400 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isTransientNetworkError(err) || attempt === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * (attempt + 1)));
    }
  }
  throw lastErr;
}
