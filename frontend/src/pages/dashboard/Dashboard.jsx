import { Navigate } from "react-router-dom";

import ReferenceDashboard from "../../components/dashboard/reference/ReferenceDashboard";
import useAuth from "../../hooks/useAuth";
import { getDashboardPathForRole } from "../../utils/roleRedirect";
import { getActiveRoleName, isOperator } from "../../config/permissions";

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

  // Sidebar "Dashboard" is `/` for all roles. Operators have a dedicated post-login home
  // (/my-job-cards) but must still be able to open the ERP dashboard from the nav.
  if (isOperator(user)) {
    return <ReferenceDashboard />;
  }

  const target = getDashboardPathForRole(user || role);
  if (target && target !== "/") {
    return <Navigate to={target} replace />;
  }

  return <ReferenceDashboard />;
}
