import { Navigate } from "react-router-dom";

import ReferenceDashboard from "../../components/dashboard/reference/ReferenceDashboard";
import useAuth from "../../hooks/useAuth";
import { getDashboardPathForRole } from "../../utils/roleRedirect";
import { getActiveRoleName } from "../../config/permissions";

function isAdminRole(role) {
  const name = String(role || "").trim().toLowerCase();
  return name === "admin" || name === "administrator";
}

export default function Dashboard() {
  const { user } = useAuth();
  const role = getActiveRoleName(user);

  if (isAdminRole(role)) {
    return <ReferenceDashboard />;
  }

  const target = getDashboardPathForRole(role);
  if (target !== "/") {
    return <Navigate to={target} replace />;
  }

  return <ReferenceDashboard />;
}
