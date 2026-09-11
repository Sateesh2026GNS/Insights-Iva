import { useContext } from "react";

import { AuthContext } from "../context/AuthContext.jsx";

/**
 * Fallback returned when this hook is called outside of <AuthProvider>.
 * Mirrors the exact shape of AuthContext's real value (see AuthContext.jsx
 * `value = useMemo(...)`) so any component destructuring fields off the
 * result keeps working — it just behaves as "logged out" — instead of the
 * whole app crashing to the top-level ErrorBoundary.
 */
const FALLBACK_AUTH_CONTEXT = {
  user: null,
  isAuthenticated: false,
  sessionExpired: false,
  clearSessionExpired: () => {},
  login: () => {},
  logout: async () => {},
  refreshUser: async () => {},
  updateUserAvatar: () => {},
};

export default function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    if (import.meta.env?.DEV) {
      // eslint-disable-next-line no-console
      console.error(
        "useAuth() was called outside of <AuthProvider>. Falling back to a " +
          "logged-out auth state instead of crashing the app. Check that the " +
          "component calling useAuth() is rendered inside <AuthProvider> " +
          "(see src/main.jsx)."
      );
    }
    return FALLBACK_AUTH_CONTEXT;
  }
  return context;
}