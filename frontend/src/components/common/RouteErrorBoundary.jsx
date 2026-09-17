import { useLocation } from "react-router-dom";

import ErrorBoundary from "./ErrorBoundary";

/**
 * Resets the error boundary when the route changes so one broken screen
 * does not block the rest of the app.
 */
export default function RouteErrorBoundary({ children }) {
  const { pathname } = useLocation();
  return <ErrorBoundary resetKey={pathname}>{children}</ErrorBoundary>;
}
