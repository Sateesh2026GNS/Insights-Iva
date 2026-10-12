import { Navigate, useLocation } from "react-router-dom";

import useAuth from "../../hooks/useAuth";

/**
 * Requires login only — no module/path RBAC. Use for 404 and other routes where
 * unknown URLs must not be treated as permission denials.
 */
export default function AuthenticatedRoute({ children }) {
  const { isAuthenticated, sessionExpired } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    if (sessionExpired) return null;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}
