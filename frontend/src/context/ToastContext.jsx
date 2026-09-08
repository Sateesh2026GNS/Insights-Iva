import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

import { setApiErrorHandler } from "../api/axiosConfig";
import { formatApiError } from "../utils/apiError";

const ToastContext = createContext(null);

function normalizeToastMessage(message) {
  if (message == null || message === "") return "Something went wrong.";
  if (typeof message === "string" || typeof message === "number") return String(message);
  return formatApiError(message);
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const lastErrorRef = useRef({ message: null, at: 0 });

  const addToast = useCallback((message, type = "success") => {
    const text = normalizeToastMessage(message);
    const lower = String(text || "").toLowerCase();

    // Prevent noisy unauthenticated / unauthorized toast notifications on login or public routes
    if (
      lower.includes("not authenticated") ||
      lower.includes("unauthorized") ||
      lower.includes("could not validate credentials") ||
      lower.includes("signature has expired") ||
      lower.includes("token has expired")
    ) {
      if (
        typeof window !== "undefined" &&
        (window.location.pathname.startsWith("/login") ||
          window.location.pathname.startsWith("/register") ||
          window.location.pathname.startsWith("/landing") ||
          window.location.pathname.startsWith("/forgot-password") ||
          window.location.pathname.startsWith("/reset-password") ||
          window.location.pathname.startsWith("/gns-admin"))
      ) {
        return;
      }
    }

    if (type === "error") {
      const now = Date.now();
      if (
        lastErrorRef.current.message === text &&
        now - lastErrorRef.current.at < 4000
      ) {
        return;
      }
      lastErrorRef.current = { message: text, at: now };
    }

    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message: text, type }]);
    const ttl = type === "error" ? 5000 : 3200;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, ttl);
  }, []);

  useEffect(() => {
    setApiErrorHandler((message) => {
      // Debounce identical errors fired within 4s to avoid toast spam.
      // Soft-suppress noisy RBAC/auth redirects from the global interceptor
      if (
        typeof window !== "undefined" &&
        ["/login", "/register", "/landing", "/forgot-password", "/reset-password", "/verify-email"].some(
          (path) => window.location.pathname.startsWith(path)
        )
      ) {
        return;
      }
      const lower = String(message || "").toLowerCase();
      if (
        lower.includes("permission") ||
        lower.includes("access to") ||
        lower.includes("not allowed") ||
        lower.includes("network error") ||
        lower.includes("failed to fetch") ||
        lower.includes("not authenticated") ||
        lower.includes("unauthorized") ||
        lower.includes("could not validate credentials")
      ) {
        return;
      }
      const now = Date.now();
      if (
        lastErrorRef.current.message === message &&
        now - lastErrorRef.current.at < 4000
      ) {
        return;
      }
      lastErrorRef.current = { message, at: now };
      addToast(message, "error");
    });
    return () => setApiErrorHandler(null);
  }, [addToast]);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed inset-x-0 top-4 z-[9999] flex flex-col items-center gap-1.5 pointer-events-none px-4">
        {toasts.filter((t) => t.type === "alert").map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex min-w-[280px] max-w-md items-center justify-between gap-6 rounded-full bg-[#FF4500] px-5 py-2.5 text-[13px] font-medium text-white shadow-lg"
          >
            <span>{t.message}</span>
            <button
              type="button"
              className="shrink-0 font-bold"
              onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
            >
              Close
            </button>
          </div>
        ))}
      </div>
      <div className="fixed bottom-5 right-5 z-[9999] flex max-w-sm flex-col gap-2.5 pointer-events-none">
        {toasts.filter((t) => t.type !== "alert").map((t) => {
          const isError = t.type === "error";
          const isWarning = t.type === "warning";
          const isCheckOut = t.type === "checkout";
          const isInfo = t.type === "info";

          const accentColor = isError
            ? "#ef4444"
            : isWarning
            ? "#f59e0b"
            : isCheckOut
            ? "#e11d48"
            : isInfo
            ? "#0284c7"
            : "#00c48c"; // Matches screenshot vibrant green

          return (
            <div
              key={t.id}
              className="pointer-events-auto relative flex items-center gap-3.5 overflow-hidden rounded-xl border border-slate-200/70 bg-white py-3.5 pl-4 pr-3.5 shadow-[0_6px_20px_rgba(0,0,0,0.08)] transition-all animate-in fade-in slide-in-from-bottom-3 duration-200"
              style={{
                minWidth: "270px",
                maxWidth: "380px",
              }}
              role="alert"
            >
              {/* Left vertical accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-2"
                style={{ backgroundColor: accentColor }}
              />

              {/* Status circular icon */}
              <div
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 ml-1"
                style={{
                  borderColor: accentColor,
                  color: accentColor,
                }}
              >
                {isError ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 stroke-current"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ) : isWarning ? (
                  <span className="text-xs font-bold leading-none">!</span>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3.5 w-3.5 stroke-current"
                    fill="none"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>

              {/* Toast message */}
              <p className="min-w-0 flex-1 text-sm font-medium text-[#1e293b] leading-snug">
                {t.message}
              </p>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { addToast: () => {} };
  return ctx;
}
