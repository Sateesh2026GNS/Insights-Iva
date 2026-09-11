import axios from "axios";

import {
  getPageRefreshGeneration,
  isPageRefreshInProgress,
} from "../utils/pageRefresh";
import { httpStatusMessage } from "../utils/apiError";

/** Resolve API base URL. Empty string = same-origin (Docker/nginx proxy). */
export function getApiBaseURL() {
  if (import.meta.env.VITE_API_BASE_URL !== undefined) {
    const raw = String(import.meta.env.VITE_API_BASE_URL || "").trim();
    return raw.replace(/\/+$/, "");
  }
  return "";
}

function isPlatformRequest(config) {
  const url = String(config?.url || "");
  return url.startsWith("/platform") || config?.skipTenantAuth === true;
}

const apiCache = new Map();
const CACHE_TTL_MS = 20_000; // 20s fast navigation cache

export function clearApiCache() {
  apiCache.clear();
}

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  try {
    if (!isPlatformRequest(config)) {
      const token = localStorage.getItem("smrt-token");
      if (token) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${token}`;
      }
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
  } else if (method === "get" && !config.skipCache) {
    const cacheKey = `${config.baseURL || ""}${config.url}?${JSON.stringify(config.params || {})}`;
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

async function refreshAccessToken(refreshToken) {
  const baseURL = getApiBaseURL();
  const { data } = await axios.post(`${baseURL}/auth/refresh`, {
    refresh_token: refreshToken,
  });
  return data;
}

function clearAuthStorage() {
  try {
    localStorage.removeItem("smrt-token");
    localStorage.removeItem("smrt-refresh-token");
    localStorage.removeItem("smrt-user");
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
    if (method === "get" && response.status === 200 && response.data && typeof response.data === "object") {
      const cacheKey = `${response.config.baseURL || ""}${response.config.url}?${JSON.stringify(response.config.params || {})}`;
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

    // Auto-retry once only for GET requests on timeout / network error
    if (method === "get" && (isTimeout || isNetworkErr) && original && !original._retryCount) {
      original._retryCount = 1;
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return api(original);
    }

    if (isTimeout || isNetworkErr) {
      error.message = "Server response timed out. Operating in offline/cached mode.";
    }
    const status = error.response?.status;

    if (
      status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh")
    ) {
      const refreshToken = localStorage.getItem("smrt-refresh-token");
      if (refreshToken) {
        original._retry = true;
        try {
          if (!refreshPromise) {
            refreshPromise = refreshAccessToken(refreshToken).finally(() => {
              refreshPromise = null;
            });
          }
          const data = await refreshPromise;
          localStorage.setItem("smrt-token", data.access_token);
          if (data.refresh_token) {
            localStorage.setItem("smrt-refresh-token", data.refresh_token);
          }
          original.headers.Authorization = `Bearer ${data.access_token}`;
          return api(original);
        } catch {
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
      }
    }
    return Promise.reject(error);
  }
);

export default api;
