import { Navigate } from "react-router-dom";
import { getPlatformToken } from "../../api/platformApi";

export default function PlatformProtectedRoute({ children }) {
  const token = getPlatformToken();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
