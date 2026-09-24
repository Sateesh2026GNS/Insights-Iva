import { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";

import { setApiErrorHandler } from "../api/axiosConfig";
import { formatApiError } from "../utils/apiError";

const ToastContext = createContext(null);

function normalizeToastMessage(message) {
  if (message == null || message === "") return "Something went wrong.";
  if (typeof message === "string" || typeof message === "number") return String(message);
  return formatApiError(message);
}

function formatSimpleToastMessage(text, isError) {
  if (isError) return text;
  const raw = String(text || "").trim();
  const lower = raw.toLowerCase();

  if (lower.includes("deactivate")) {
    return "Deactivated successfully";
  }
  if (lower.includes("delete") || lower.includes("remove")) {
    return "Deleted successfully";
  }
  if (lower.includes("clear")) {
    return "Cleared successfully";
  }
  if (lower.includes("disable")) {
    return "Disabled successfully";
  }
  if (lower.includes("reject")) {
    return "Rejected successfully";
  }
  if (lower.includes("cancel")) {
    return "Cancelled successfully";
  }
  if (lower.includes("create") || lower.includes("add") || lower.includes("generate")) {
    return "Created successfully";
  }
  if (lower.includes("update")) {
    return "Updated successfully";
  }
  if (lower.includes("save")) {
    return "Saved successfully";
  }

  let cleanStr = raw.split(".")[0].trim();
  if (!cleanStr.toLowerCase().includes("success")) {
    cleanStr += " successfully";
  }
  return cleanStr;
}

function checkIsRedToast(type, text) {
  if (
    type === "error" ||
    type === "danger" ||
    type === "delete" ||
    type === "destructive" ||
    type === "deactivate" ||
    type === "warning"
  ) {
    return true;
  }
  const lower = String(text || "").toLowerCase();
  return (
    lower.includes("deactivate") ||
    lower.includes("delete") ||
    lower.includes("clear") ||
    lower.includes("remove") ||
    lower.includes("disable") ||
    lower.includes("reject") ||
    lower.includes("cancel") ||
    lower.includes("revoke") ||
    lower.includes("destroy")
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const lastErrorRef = useRef({ message: null, at: 0 });

  const addToast = useCallback((message, type = "success") => {
    let text = normalizeToastMessage(message);
    const isError = type === "error";
    text = formatSimpleToastMessage(text, isError);
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

    if (isError) {
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
    const isRed = checkIsRedToast(type, text);
    // Green (create/update/save) toasts load for 1 sec (1000ms); red error/deactivate/delete/clear toasts have no load bar
    const ttl = isError ? 4000 : 1000;
    setToasts((prev) => [...prev, { id, message: text, type, isRed, ttl }]);
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
      <style>{`
        @keyframes toastProgressBarReverse {
          0% {
            width: 100%;
          }
          100% {
            width: 0%;
          }
        }
      `}</style>
      {children}
      {/* Top Notification / Toast Container (positioned cleanly below the header bar) */}
      <div className="fixed top-[calc(var(--navbar-height,3.5rem)+0.75rem)] right-4 sm:right-6 z-[9999] flex flex-col items-center sm:items-end gap-2.5 pointer-events-none max-w-[calc(100vw-2rem)] sm:max-w-md w-full sm:w-auto">
        {toasts.map((t) => {
          const isRed = t.isRed || t.type === "error";

          // Accent colors: Red for error, deactivate, delete, clear; Green for success/create/update/save
          const accentColor = isRed ? "#ef4444" : "#00c48c"; // Vibrant red vs vibrant success green

          return (
            <div
              key={t.id}
              className="pointer-events-auto relative flex items-center gap-3 overflow-hidden rounded-xl border border-slate-200/90 bg-white/95 backdrop-blur-md pb-4 pt-3.5 pl-3.5 pr-3 shadow-[0_10px_25px_-5px_rgba(0,0,0,0.12),0_8px_10px_-6px_rgba(0,0,0,0.06),0_1px_3px_rgba(0,0,0,0.08)] transition-all animate-in fade-in slide-in-from-top-3 duration-200 w-full sm:w-auto"
              style={{
                minWidth: "280px",
                maxWidth: "420px",
              }}
              role="alert"
            >
              {/* Left vertical accent bar */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1.5"
                style={{ backgroundColor: accentColor }}
              />

              {/* Status circular icon badge */}
              <div
                className="grid h-7 w-7 shrink-0 place-items-center rounded-full ml-0.5"
                style={{
                  backgroundColor: `${accentColor}18`,
                  color: accentColor,
                }}
              >
                {isRed ? (
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
              <p className="min-w-0 flex-1 text-sm font-semibold text-slate-800 leading-snug break-words">
                {t.message}
              </p>

              {/* Dismiss button */}
              <button
                type="button"
                onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors p-1"
                aria-label="Close notification"
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

              {/* Loading progress bar line:
                  Only rendered for GREEN (non-red) toasts.
                  Red toasts (error, deactivate, delete, clear, remove, etc.) have NO loading line.
              */}
              {!isRed && (
                <div className="absolute bottom-0 left-0 right-0 h-[3px] overflow-hidden rounded-b-xl">
                  <div
                    className="h-full rounded-b-xl opacity-90"
                    style={{
                      backgroundColor: accentColor,
                      animation: `toastProgressBarReverse ${t.ttl || 1000}ms linear forwards`,
                    }}
                  />
                </div>
              )}
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
