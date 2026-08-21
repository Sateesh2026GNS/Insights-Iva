import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  emitPageRefreshEvent,
  playPageRefreshBlink,
  runPageRefresh,
} from "../../utils/pageRefresh";

const MIN_SPIN_MS = 400;
const POPUP_DURATION_MS = 1500;

/**
 * Fixed bottom-right refresh control for the ERP shell.
 * Re-fetches registered page loaders via usePageRefresh (in-place SPA refresh).
 * Displays "Updated just now" ONLY when the user clicks this refresh button.
 */
export default function GlobalRefreshButton({ offsetForChat = false }) {
  const [refreshing, setRefreshing] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const timerRef = useRef(null);
  const inFlightRef = useRef(false);

  // Clear legacy sessionStorage flags on mount so they never linger
  useEffect(() => {
    try {
      sessionStorage.removeItem("gns_manual_refresh_clicked");
      sessionStorage.removeItem("gns_page_refreshed");
    } catch {
      // ignore
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    if (inFlightRef.current || refreshing) return;
    inFlightRef.current = true;
    setRefreshing(true);

    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setShowPopup(false);

    const started = Date.now();

    try {
      playPageRefreshBlink();
      emitPageRefreshEvent({ source: "global-refresh" });
      await runPageRefresh();
    } catch (err) {
      console.warn("Page refresh error:", err);
    } finally {
      const elapsed = Date.now() - started;
      if (elapsed < MIN_SPIN_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_SPIN_MS - elapsed));
      }

      setRefreshing(false);
      inFlightRef.current = false;

      // Show "Updated just now" popup ONLY after user clicks refresh
      setShowPopup(true);
      timerRef.current = setTimeout(() => {
        setShowPopup(false);
        timerRef.current = null;
      }, POPUP_DURATION_MS);
    }
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
        title={refreshing ? "Refreshing page…" : "Refresh page"}
        aria-label="Refresh page"
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
