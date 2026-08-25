/**
 * In-memory TTL cache for read-heavy master/reference API responses.
 * Not a substitute for server data — avoids duplicate fetches during navigation.
 */

const DEFAULT_TTL_MS = 3 * 60 * 1000; // 3 minutes

const stores = new Map();

function storeKey(namespace, tenantKey = "default") {
  return `${namespace}::${tenantKey}`;
}

function getTenantKey() {
  try {
    const raw = localStorage.getItem("smrt-user");
    if (!raw) return "default";
    const user = JSON.parse(raw);
    return String(user.tenant_id ?? user.company_id ?? "default");
  } catch {
    return "default";
  }
}

/**
 * @param {string} namespace - e.g. "customers", "vendors"
 * @param {() => Promise<any>} fetchFn
 * @param {{ ttlMs?: number, force?: boolean }} [options]
 */
export async function getCachedReference(namespace, fetchFn, options = {}) {
  const { ttlMs = DEFAULT_TTL_MS, force = false } = options;
  const key = storeKey(namespace, getTenantKey());
  const now = Date.now();
  const entry = stores.get(key);

  if (!force && entry?.data != null && now < entry.expires) {
    return entry.data;
  }

  if (entry?.promise) {
    return entry.promise;
  }

  const promise = Promise.resolve()
    .then(() => fetchFn())
    .then((data) => {
      stores.set(key, { data, expires: Date.now() + ttlMs, promise: null });
      return data;
    })
    .catch((err) => {
      const current = stores.get(key);
      if (current?.promise === promise) {
        stores.set(key, { ...current, promise: null });
      }
      throw err;
    });

  stores.set(key, {
    data: entry?.data ?? null,
    expires: entry?.expires ?? 0,
    promise,
  });

  return promise;
}

/** Clear all in-memory reference caches (login/logout/tenant switch). */
export function invalidateReferenceCache(namespace) {
  if (namespace) {
    const prefix = `${namespace}::`;
    for (const key of stores.keys()) {
      if (key.startsWith(prefix)) stores.delete(key);
    }
    return;
  }
  stores.clear();
}
