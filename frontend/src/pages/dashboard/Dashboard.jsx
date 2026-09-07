import { Navigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import { getDashboardPathForRole } from "../../utils/roleRedirect";
import { getActiveRoleName } from "../../config/permissions";

/** Redirects `/` to the role-specific module home (no standalone ERP dashboard page). */
export default function Dashboard() {
  const { user } = useAuth();
  const target = getDashboardPathForRole(getActiveRoleName(user));
  return <Navigate to={target} replace />;
}
