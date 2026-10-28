import { Navigate, useLocation } from "react-router-dom";

import AccessDenied from "../admin/AccessDenied";
import { isOperator, userCanAccessPath } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";

/**
 * Requires JWT auth + module/path permission for the current route.
 * Unauthorized users see a 403 Access Denied page (no silent redirect).
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, user, sessionExpired } = useAuth();
  const location = useLocation();

  // Session expiry is handled by SessionExpiredModal — avoid racing a hard redirect.
  if (!isAuthenticated) {
    if (sessionExpired) return null;
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!userCanAccessPath(user, location.pathname)) {
    if (isOperator(user) && location.pathname !== "/dashboard") {
      return <Navigate to="/dashboard" replace />;
    }
    const path = location.pathname || "";
    const message = path.startsWith("/settings/")
      ? "This settings area is only available to administrators. Open Settings from the menu for your account options, or return to the dashboard."
      : "You do not have permission to access this page.";
    return <AccessDenied message={message} />;
  }

  return children;
}
