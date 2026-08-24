import { Navigate } from "react-router-dom";

import ReferenceDashboard from "../../components/dashboard/reference/ReferenceDashboard";
import useAuth from "../../hooks/useAuth";
import { getDashboardPathForRole } from "../../utils/roleRedirect";
import { getActiveRoleName } from "../../config/permissions";

export default function Dashboard() {
  const { user } = useAuth();
  const target = getDashboardPathForRole(getActiveRoleName(user));
  if (target !== "/") {
    return <Navigate to={target} replace />;
  }
  return <ReferenceDashboard />;
}
