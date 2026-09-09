import React, { Suspense } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import "./i18n";
import { BrowserRouter, useLocation } from "react-router-dom";

import App from "./App.jsx";
import BrandLogo from "./components/common/BrandLogo";
import ErrorBoundary from "./components/common/ErrorBoundary";
import SessionExpiredModal from "./components/common/states/SessionExpiredModal";
import { AuthProvider } from "./context/AuthContext.jsx";
import { NetworkStatusProvider } from "./context/NetworkStatusContext.jsx";
import { SettingsProvider } from "./context/SettingsContext.jsx";
import { ToastProvider } from "./context/ToastContext.jsx";
import useAuth from "./hooks/useAuth";

// Automatically reload once if a newly deployed build has changed chunk hashes
if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    const lastReload = sessionStorage.getItem("vite_preload_retry");
    const now = Date.now();
    if (!lastReload || now - Number(lastReload) > 15000) {
      sessionStorage.setItem("vite_preload_retry", String(now));
      window.location.reload();
    }
  });
}

import BrandLoadingScreen from "./components/common/BrandLoadingScreen";

const LoadingFallback = () => <BrandLoadingScreen />;

function SessionGate({ children }) {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const location = useLocation();

  React.useEffect(() => {
    if (
      sessionExpired &&
      (location.pathname === "/login" ||
        location.pathname.startsWith("/gns-admin") ||
        location.pathname.startsWith("/register") ||
        location.pathname === "/landing")
    ) {
      clearSessionExpired();
    }
  }, [location.pathname, sessionExpired, clearSessionExpired]);

  const showModal =
    Boolean(sessionExpired) &&
    location.pathname !== "/login" &&
    !location.pathname.startsWith("/gns-admin") &&
    !location.pathname.startsWith("/register") &&
    location.pathname !== "/landing";

  return (
    <>
      {children}
      <SessionExpiredModal open={showModal} onLogin={clearSessionExpired} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <SettingsProvider>
        <AuthProvider>
          <ToastProvider>
            <NetworkStatusProvider>
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Suspense fallback={<LoadingFallback />}>
                  <SessionGate>
                    <App />
                  </SessionGate>
                </Suspense>
              </BrowserRouter>
            </NetworkStatusProvider>
          </ToastProvider>
        </AuthProvider>
      </SettingsProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
