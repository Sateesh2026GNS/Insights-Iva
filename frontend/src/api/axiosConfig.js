import axios from "axios";

import {
  clearLegacyAuthTokens,
  isFastOfflineSessionToken,
  markBrowserSessionActive,
} from "../utils/authSession";
import { getCsrfTokenFromCookie, setCsrfToken } from "../utils/csrf";
import {
  getPageRefreshGeneration,
  isPageRefreshInProgress,
} from "../utils/pageRefresh";
import { httpStatusMessage } from "../utils/apiError";
import {
  checkSessionStatus,
  isPrimaryTabAlive,
  recordSessionActivity,
} from "../utils/sessionManager";
import { triggerServerWakeup } from "../utils/serverWakeup";

export const AUTH_TOKEN_UPDATED_EVENT = "smrt-auth-token-updated";

function notifyAuthSessionUpdated() {
  try {
    window.dispatchEvent(new CustomEvent(AUTH_TOKEN_UPDATED_EVENT, { detail: {} }));
  } catch {}
}

function applyLoginAuthPayload(data) {
  if (!data || typeof data !== "object") return;
  const access = data.access_token ?? data.token;
  const refresh = data.refresh_token;
  if (data.csrf_token) {
    setCsrfToken(data.csrf_token);
  }
  if (access || refresh) {
    if (access && isFastOfflineSessionToken(access)) {
      return;
    }
  }
  markBrowserSessionActive();
  clearLegacyAuthTokens();
  notifyAuthSessionUpdated();
}

function isDefinitiveSessionExpiry(reason) {
  return reason === "primary_9hr_timeout" || reason === "new_tab_10min_timeout";
}

/** Resolve API base URL. Empty string = same-origin (Docker/nginx proxy). */
export function getApiBaseURL() {
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname || "";
    const isLocalhost =
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "0.0.0.0" ||
      hostname === "::1" ||
      hostname.endsWith(".local");

    const envUrl = String(import.meta.env.VITE_API_BASE_URL || "").trim();
    if (envUrl) {
      let raw = envUrl.replace(/\/+$/, "");
      if (raw === "http://localhost:8000") {
        raw = "http://127.0.0.1:8000";
      }
      // If VITE_API_BASE_URL points to localhost but the site is loaded from a global/remote host,
      // override localhost so the browser doesn't attempt to connect to 127.0.0.1 on the remote visitor's device.
      if (!isLocalhost && (raw.includes("localhost") || raw.includes("127.0.0.1"))) {
        return "https://insights-iva-api.onrender.com";
      }
      return raw;
    }

    if (!isLocalhost) {
      return "https://insights-iva-api.onrender.com";
    }
  }

  let raw = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
  if (raw === "http://localhost:8000") {
    raw = "http://127.0.0.1:8000";
  }
  return raw;
}

function isPlatformRequest(config) {
  const url = String(config?.url || "");
  return url.startsWith("/platform") || config?.skipTenantAuth === true;
}

const apiCache = new Map();
const CACHE_TTL_MS = 20_000; // Short TTL — faster back-navigation without stale writes.

if (typeof window !== "undefined") {
  window.addEventListener("focus", clearApiCache);
  window.addEventListener("storage", clearApiCache);
}

function getApiCacheScope() {
  try {
    const raw = localStorage.getItem("smrt-user");
    if (!raw) return "anon";
    const user = JSON.parse(raw);
    return String(user.tenant_id ?? user.company_id ?? user.id ?? "anon");
  } catch {
    return "anon";
  }
}

function buildApiCacheKey(config) {
  const scope = getApiCacheScope();
  return `${scope}|${config.baseURL || ""}${config.url}?${JSON.stringify(config.params || {})}`;
}

export function clearApiCache() {
  apiCache.clear();
}

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 90_000,
  withCredentials: true,
});

const rawAxios = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 90_000,
  withCredentials: true,
});

function attachCsrfHeader(config) {
  const method = String(config.method || "get").toLowerCase();
  if (method === "get" || method === "head" || method === "options") {
    return config;
  }
  config.headers = config.headers || {};
  config.headers["X-Requested-With"] = "InsightsIva";
  const csrf = getCsrfTokenFromCookie();
  if (csrf) {
    config.headers["X-CSRF-Token"] = csrf;
  }
  return config;
}

export async function ensureCsrfCookie() {
  try {
    const { data } = await rawAxios.get("/auth/csrf", { skipGlobalError: true });
    if (data?.csrf_token) {
      setCsrfToken(data.csrf_token);
    }
  } catch {
    /* non-fatal before login */
  }
}

api.interceptors.request.use((config) => {
  try {
    if (!isPlatformRequest(config)) {
      const sessionStatus = checkSessionStatus();
      if (sessionStatus.expired && isDefinitiveSessionExpiry(sessionStatus.reason)) {
        if (sessionStatus.reason === "primary_9hr_timeout" || !isPrimaryTabAlive()) {
          clearAuthStorage();
        }
        if (typeof onUnauthorized === "function") {
          onUnauthorized();
        }
        const err = new Error("Session expired");
        err.response = { status: 401, data: { message: "Session expired", reason: sessionStatus.reason } };
        return Promise.reject(err);
      }
      attachCsrfHeader(config);
    }
  } catch {}

  const method = String(config.method || "get").toLowerCase();

  // Clear cache on write operations (POST, PUT, PATCH, DELETE)
  if (method !== "get" && method !== "head") {
    clearApiCache();
  }

  // During global Refresh, force a network re-fetch (no stale cached responses).
  if (isPageRefreshInProgress()) {
    clearApiCache();
    config.headers = config.headers || {};
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
    if (method === "get" || method === "head") {
      const params = { ...(config.params || {}) };
      params._r = getPageRefreshGeneration();
      config.params = params;
    }
  } else if (
    method === "get" &&
    !config.skipCache &&
    config.responseType !== "blob" &&
    config.responseType !== "arraybuffer"
  ) {
    const cacheKey = buildApiCacheKey(config);
    const cached = apiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      config.adapter = () =>
        Promise.resolve({
          data: JSON.parse(JSON.stringify(cached.data)),
          status: cached.status,
          statusText: cached.statusText,
          headers: cached.headers,
          config,
          request: {},
        });
      return config;
    }
  }

  return config;
});

let onUnauthorized = null;

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

let onApiError = null;

export function setApiErrorHandler(handler) {
  onApiError = handler;
}

let refreshPromise = null;

async function refreshAccessToken() {
  const baseURL = getApiBaseURL();
  const headers = { "X-Requested-With": "InsightsIva" };
  const csrf = getCsrfTokenFromCookie();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  const { data } = await rawAxios.post(`${baseURL}/auth/refresh`, {}, { headers });
  applyLoginAuthPayload(data);
  return data;
}

function clearAuthStorage() {
  try {
    clearLegacyAuthTokens();
    localStorage.removeItem("smrt-user");
    localStorage.removeItem("smrt-session-active");
  } catch {}
}

api.interceptors.response.use(
  (response) => {
    // If the server returns HTML (common when SPA hosting rewrites unknown API routes to index.html),
    // treat it as an unavailable API endpoint rather than valid JSON data.
    const contentType = response.headers?.["content-type"] || "";
    if (
      typeof response.data === "string" &&
      (contentType.includes("text/html") ||
        response.data.trim().startsWith("<!doctype html") ||
        response.data.trim().startsWith("<html"))
    ) {
      const err = new Error("API endpoint not available on this host");
      err.response = {
        status: 404,
        data: { message: "API endpoint not available on this host", detail: "Not Found" },
      };
      err.config = response.config;
      return Promise.reject(err);
    }
    const method = String(response.config?.method || "get").toLowerCase();
    if (!isPlatformRequest(response.config)) {
      recordSessionActivity();
    }

    const isBinaryData =
      response.config?.responseType === "blob" ||
      response.config?.responseType === "arraybuffer" ||
      (typeof Blob !== "undefined" && response.data instanceof Blob) ||
      (typeof ArrayBuffer !== "undefined" && response.data instanceof ArrayBuffer);

    if (
      method === "get" &&
      response.status === 200 &&
      response.data &&
      typeof response.data === "object" &&
      !isBinaryData
    ) {
      const cacheKey = buildApiCacheKey(response.config);
      apiCache.set(cacheKey, {
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        timestamp: Date.now(),
      });
    }
    return response;
  },
  async (error) => {
    const original = error.config;
    const method = String(original?.method || "get").toLowerCase();
    const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
    const isNetworkErr = error.code === "ERR_NETWORK";
    const status = error.response?.status;
    const isGatewayError = status === 502 || status === 503 || status === 504;

    // Auto-retry up to 4 times for GET requests on timeout / network error / gateway spin-up errors (e.g. Render server cold-starts)
    const maxRetries = isGatewayError ? 4 : 3;
    if (method === "get" && (isTimeout || isNetworkErr || isGatewayError) && original && (original._retryCount || 0) < maxRetries) {
      original._retryCount = (original._retryCount || 0) + 1;
      triggerServerWakeup({ force: true });
      const delayMs = 1500 * Math.pow(1.4, original._retryCount - 1);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api(original);
    }

    // Fallback: If GET request fails due to timeout/network error but we have cached data in apiCache, return cached response
    if (method === "get" && (isTimeout || isNetworkErr || isGatewayError) && original) {
      const cacheKey = buildApiCacheKey(original);
      const cached = apiCache.get(cacheKey);
      if (cached) {
        return {
          data: JSON.parse(JSON.stringify(cached.data)),
          status: cached.status,
          statusText: cached.statusText,
          headers: { ...cached.headers, "x-offline-cached": "true" },
          config: original,
          request: {},
          isOfflineCached: true,
        };
      }
    }

    if (!error.response && (isTimeout || isNetworkErr || isGatewayError)) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        error.message = "Network error: You appear to be offline. Check your internet connection.";
      } else if (isGatewayError) {
        error.message = "Server is starting up or temporarily unavailable. Please try again in a moment.";
      } else if (isTimeout) {
        error.message = "Server response timed out. Please try again.";
      } else {
        error.message = "Unable to connect to server. Please try again.";
      }
    }

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      const sessionStatus = checkSessionStatus();
      if (sessionStatus.expired && isDefinitiveSessionExpiry(sessionStatus.reason)) {
        if (sessionStatus.reason === "primary_9hr_timeout" || !isPrimaryTabAlive()) {
          clearAuthStorage();
        }
        if (typeof onUnauthorized === "function") {
          onUnauthorized();
        }
        return Promise.reject(error);
      }

      original._retry = true;
      try {
        if (!refreshPromise) {
          refreshPromise = refreshAccessToken().finally(() => {
            refreshPromise = null;
          });
        }
        await refreshPromise;
        attachCsrfHeader(original);
        return api(original);
      } catch (refreshErr) {
        const refreshStatus = refreshErr?.response?.status;
        if (refreshStatus === 401 || refreshStatus === 403) {
          clearAuthStorage();
        }
      }
    }

    const isAuthUrl =
      original?.url?.includes("/auth/login") ||
      original?.url?.includes("/platform/auth/login") ||
      original?.url?.includes("/auth/verify-otp") ||
      original?.url?.includes("/platform/auth/verify-otp") ||
      original?.url?.includes("/auth/refresh");

    if (status === 401 && !isAuthUrl) {
      clearAuthStorage();
      if (typeof onUnauthorized === "function") {
        onUnauthorized();
      } else if (
        typeof window !== "undefined" &&
        !window.location.pathname.startsWith("/login") &&
        !window.location.pathname.startsWith("/gns-admin")
      ) {
        window.location.assign("/login");
      }
    } else if (typeof onApiError === "function" && !error.config?.skipGlobalError && !isAuthUrl) {
      if (error.code === "ERR_NETWORK" || error.code === "ECONNABORTED" || (status && status >= 500)) {
        onApiError(httpStatusMessage(error));
      } else if (status === 403) {
        onApiError(httpStatusMessage(error, "You don't have permission to perform this action."));
      } else if (status === 429) {
        onApiError(httpStatusMessage(error, "Too many requests. Please wait and try again."));
      }
    }
    return Promise.reject(error);
  }
);

export function handleAuthLoginResponse(data) {
  applyLoginAuthPayload(data);
  return data;
}

export default api;
