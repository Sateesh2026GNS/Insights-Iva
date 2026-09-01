import axios from "axios";

import {
  getPageRefreshGeneration,
  isPageRefreshInProgress,
} from "../utils/pageRefresh";
import { httpStatusMessage } from "../utils/apiError";

/** Resolve API base URL. Empty string = same-origin (Docker/nginx proxy). */
export function getApiBaseURL() {
  if (import.meta.env.VITE_API_BASE_URL !== undefined) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  return "";
}

function isPlatformRequest(config) {
  const url = String(config?.url || "");
  return url.startsWith("/platform") || config?.skipTenantAuth === true;
}

const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 30000,
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

  // During global Refresh, force a network re-fetch (no stale cached responses).
  if (isPageRefreshInProgress()) {
    config.headers = config.headers || {};
    config.headers["Cache-Control"] = "no-cache";
    config.headers.Pragma = "no-cache";
    const method = String(config.method || "get").toLowerCase();
    if (method === "get" || method === "head") {
      const params = { ...(config.params || {}) };
      params._r = getPageRefreshGeneration();
      config.params = params;
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
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const original = error.config;

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
