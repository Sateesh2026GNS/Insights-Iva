import { useCallback, useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import Button from "./Button";
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
/** Inline toolbar refresh — same behavior as the global FAB (usePageRefresh handlers). */
export function ToolbarPageRefreshButton({
  variant = "secondary",
  size = "sm",
  className = "",
  showLabel = true,
}) {
  const [refreshing, setRefreshing] = useState(false);
  const inFlightRef = useRef(false);

  const handleRefresh = useCallback(async () => {
    if (inFlightRef.current || refreshing) return;
    inFlightRef.current = true;
    setRefreshing(true);
    try {
      playPageRefreshBlink();
      emitPageRefreshEvent({ source: "toolbar-refresh" });
      await runPageRefresh();
    } catch (err) {
      console.warn("Page refresh error:", err);
    } finally {
      setRefreshing(false);
      inFlightRef.current = false;
    }
  }, [refreshing]);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={handleRefresh}
      disabled={refreshing}
      title={refreshing ? "Refreshing page…" : "Refresh page"}
      aria-label="Refresh page"
      aria-busy={refreshing}
      leftIcon={
        <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} aria-hidden />
      }
    >
      {showLabel ? (refreshing ? "Refreshing…" : "Refresh") : null}
    </Button>
  );
}

export default function GlobalRefreshButton({ stacked = false }) {
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

  const rootClass = stacked
    ? "pointer-events-none flex flex-col items-end gap-2"
    : "pointer-events-none fixed bottom-5 right-5 z-[90] flex flex-col items-end gap-2 sm:bottom-6 sm:right-6";

  return (
    <div className={rootClass}>
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
        className="app-shell-fab app-shell-fab--surface"
      >
        <RefreshCw
          className={`h-5 w-5 ${refreshing ? "animate-spin text-[var(--color-primary)]" : ""}`}
          aria-hidden
        />
      </button>
    </div>
  );
}
