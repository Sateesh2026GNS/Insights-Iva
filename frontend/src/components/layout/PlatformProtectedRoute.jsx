import { Navigate } from "react-router-dom";
import { getPlatformToken } from "../../api/platformApi";

export default function PlatformProtectedRoute({ children }) {
  const token = getPlatformToken();
  if (!token) {
    return <Navigate to="/gns-admin/login" replace />;
  }
  return children;
}
