import { createContext, useCallback, useEffect, useMemo, useState } from "react";

import { getCurrentUser, logout as logoutApi } from "../api/authApi";
import { setUnauthorizedHandler } from "../api/axiosConfig";
import { invalidateReferenceCache } from "../utils/referenceDataCache";

export const AuthContext = createContext(null);

function getAvatarStorageKey(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tenantKey =
    raw.company_id ||
    raw.tenant_id ||
    raw.company_name ||
    raw.tenant_name ||
    raw.tenant ||
    "default_tenant";
  const userKey = raw.id || raw.email || raw.username || "default_user";
  return `smrt-avatar-${tenantKey}-${userKey}`;
}

function normalizeUser(raw) {
  if (!raw || typeof raw !== "object") return null;
  const fullName = raw.full_name ?? raw.name ?? "User";
  let avatar = raw.avatar ?? raw.profile_picture ?? raw.photo ?? null;
  if (!avatar) {
    const key = getAvatarStorageKey(raw);
    if (key) {
      try {
        avatar = localStorage.getItem(key) || null;
      } catch {}
    }
  }
  return {
    ...raw,
    full_name: fullName,
    name: fullName,
    avatar,
    role: raw.role ?? raw.role_name ?? "Operator",
    role_name: raw.role_name ?? raw.role ?? "Operator",
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  };
}

function readStoredUser() {
  try {
    const token = localStorage.getItem("smrt-token");
    if (!token) return null;
    const stored = localStorage.getItem("smrt-user");
    if (stored) return normalizeUser(JSON.parse(stored));
  } catch {}
  return null;
}

function clearTenantDataCaches() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith("smrt_") ||
          k.startsWith("gns_") ||
          k.startsWith("smrt-company-") ||
          k.startsWith("smrt-avatar-") ||
          k === "smrt-current-avatar")
      ) {
        if (
          !k.startsWith("smrt-token") &&
          !k.startsWith("smrt-refresh") &&
          !k.startsWith("smrt-user") &&
          !k.startsWith("smrt-language")
        ) {
          keys.push(k);
        }
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
  invalidateReferenceCache();
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      const isAuthPage =
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/login") ||
          window.location.pathname.startsWith("/gns-admin") ||
          window.location.pathname.startsWith("/register") ||
          window.location.pathname === "/landing");
      if (!isAuthPage) {
        setSessionExpired(true);
      }
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    try {
      const token = localStorage.getItem("smrt-token");
      if (!token && user) {
        setUser(null);
        localStorage.removeItem("smrt-user");
      }
    } catch {}
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    let token = null;
    try {
      token = localStorage.getItem("smrt-token");
    } catch {
      return undefined;
    }
    if (!token) return undefined;

    getCurrentUser()
      .then((data) => {
        if (cancelled || !data) return;
        const u = normalizeUser(data);
        setUser(u);
        try {
          localStorage.setItem("smrt-user", JSON.stringify(u));
        } catch {}
      })
      .catch((err) => {
        if (cancelled) return;
        if (err.response?.status === 401) {
          try {
            clearTenantDataCaches();
            localStorage.removeItem("smrt-token");
            localStorage.removeItem("smrt-refresh-token");
            localStorage.removeItem("smrt-user");
          } catch {}
          setUser(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((authData) => {
    setSessionExpired(false);
    clearTenantDataCaches();
    let u;
    if (typeof authData === "object" && authData !== null) {
      const token = authData.access_token ?? authData.token;
      const refreshToken = authData.refresh_token;
      const userPayload = authData.user ?? authData;
      const rest = { ...userPayload };
      delete rest.access_token;
      delete rest.refresh_token;
      u = normalizeUser(rest);
      if (token) {
        try {
          localStorage.setItem("smrt-token", token);
        } catch {}
      }
      if (refreshToken) {
        try {
          localStorage.setItem("smrt-refresh-token", refreshToken);
        } catch {}
      }
    } else {
      u = { name: String(authData), role: "Operator" };
    }
    setUser(u);
    try {
      localStorage.setItem("smrt-user", JSON.stringify(u));
      if (u?.tenant_name) {
        localStorage.setItem("smrt-company-name", u.tenant_name);
      }
    } catch {}
  }, []);

  const logout = useCallback(async ({ allDevices = false } = {}) => {
    try {
      const refreshToken = localStorage.getItem("smrt-refresh-token");
      if (refreshToken) {
        await logoutApi(refreshToken, { allDevices }).catch(() => {});
      }
    } catch {
      /* ignore network errors — still clear local session */
    } finally {
      setUser(null);
      setSessionExpired(false);
      try {
        clearTenantDataCaches();
        localStorage.removeItem("smrt-user");
        localStorage.removeItem("smrt-token");
        localStorage.removeItem("smrt-refresh-token");
      } catch {
        /* ignore */
      }
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const token = localStorage.getItem("smrt-token");
      if (!token) return;
      const data = await getCurrentUser();
      const u = normalizeUser(data);
      setUser(u);
      localStorage.setItem("smrt-user", JSON.stringify(u));
    } catch {
      /* ignore */
    }
  }, []);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);

  const updateUserAvatar = useCallback((avatarData) => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, avatar: avatarData || null };
      const key = getAvatarStorageKey(prev);
      try {
        localStorage.setItem("smrt-user", JSON.stringify(updated));
        if (key) {
          if (avatarData) {
            localStorage.setItem(key, avatarData);
          } else {
            localStorage.removeItem(key);
          }
        }
        // Purge legacy unscoped keys that cause cross-company avatar leaks
        localStorage.removeItem("smrt-current-avatar");
        if (prev.id) {
          localStorage.removeItem(`smrt-avatar-${prev.id}`);
        }
      } catch {}
      return updated;
    });
  }, []);

  const value = useMemo(() => {
    let hasToken = false;
    try {
      hasToken = Boolean(localStorage.getItem("smrt-token"));
    } catch {}
    return {
      user,
      isAuthenticated: Boolean(user && hasToken),
      sessionExpired,
      clearSessionExpired,
      login,
      logout,
      refreshUser,
      updateUserAvatar,
    };
  }, [user, sessionExpired, clearSessionExpired, login, logout, refreshUser, updateUserAvatar]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}