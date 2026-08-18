import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Fixed bottom-right refresh control for the ERP shell.
 * Performs a full whole-page browser reload (window.location.reload()).
 * Displays a 1-second popup message "Updated just now" when refreshed.
 */
export default function GlobalRefreshButton({ offsetForChat = false }) {
  const [refreshing, setRefreshing] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const timerRef = useRef(null);

  useEffect(() => {
    // ONLY show popup if user explicitly clicked the refresh button
    let wasManualRefresh = false;
    try {
      if (sessionStorage.getItem("gns_manual_refresh_clicked") === "true") {
        wasManualRefresh = true;
        sessionStorage.removeItem("gns_manual_refresh_clicked");
      }
    } catch {
      // fallback
    }

    if (wasManualRefresh) {
      setShowPopup(true);
      timerRef.current = setTimeout(() => {
        setShowPopup(false);
      }, 1500);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      sessionStorage.setItem("gns_manual_refresh_clicked", "true");
    } catch {
      // fallback
    }
    setTimeout(() => {
      window.location.reload();
    }, 150);
  }, [refreshing]);

  return (
    <div
      className={`pointer-events-none fixed right-5 z-[90] flex flex-col items-end gap-2 sm:right-6 ${
        offsetForChat ? "bottom-24 sm:bottom-28" : "bottom-5 sm:bottom-6"
      }`}
    >
      {showPopup ? (
        <div
          role="status"
          aria-live="polite"
          className="pointer-events-none animate-fade-in rounded-lg border border-slate-300/90 bg-white px-3 py-1.5 text-xs font-semibold text-black shadow-md transition-opacity duration-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
        >
          Updated just now
        </div>
      ) : null}
      <button
        type="button"
        onClick={handleRefresh}
        disabled={refreshing}
        title={refreshing ? "Refreshing page…" : "Refresh whole page"}
        aria-label="Refresh whole page"
        aria-busy={refreshing}
        className="pointer-events-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-slate-300/80 bg-white text-slate-700 shadow-lg transition-all duration-200 hover:scale-105 hover:border-teal-600 hover:bg-slate-50 hover:text-[var(--color-success)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40 focus-visible:ring-offset-2 active:scale-95 disabled:pointer-events-none disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-teal-400 dark:hover:text-teal-400"
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? "animate-spin text-teal-600 dark:text-teal-400" : ""}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
