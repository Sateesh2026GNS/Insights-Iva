import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { OfflineBanner } from "../components/common/states/OfflineState";
import SlowNetworkBanner from "../components/common/states/SlowNetworkBanner";

const NetworkStatusContext = createContext({
  online: true,
  slow: false,
  markRequestStart: () => {},
  markRequestEnd: () => {},
  dismissSlow: () => {},
});

// Only trigger if an operation takes longer than 12 seconds
const SLOW_MS = 12000;
// Auto-dismiss the slow banner after 6 seconds so it never gets stuck
const AUTO_DISMISS_MS = 6000;

/**
 * Tracks browser online/offline and slow in-flight requests.
 * Auto-retries registered callbacks when connectivity returns.
 */
export function NetworkStatusProvider({ children }) {
  const [online, setOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine
  );
  const [slow, setSlow] = useState(false);
  const pendingRef = useRef(0);
  const slowTimerRef = useRef(null);
  const autoDismissTimerRef = useRef(null);
  const retryFnsRef = useRef(new Set());

  const clearSlowTimers = () => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  };

  const dismissSlow = useCallback(() => {
    clearSlowTimers();
    setSlow(false);
    pendingRef.current = 0;
  }, []);

  const markRequestStart = useCallback(() => {
    pendingRef.current += 1;
    if (!slowTimerRef.current) {
      slowTimerRef.current = setTimeout(() => {
        if (pendingRef.current > 0) {
          setSlow(true);
          // Safety: Auto-dismiss so the banner never gets permanently stuck
          autoDismissTimerRef.current = setTimeout(() => {
            setSlow(false);
            pendingRef.current = 0;
          }, AUTO_DISMISS_MS);
        }
      }, SLOW_MS);
    }
  }, []);

  const markRequestEnd = useCallback(() => {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current === 0) {
      clearSlowTimers();
      setSlow(false);
    }
  }, []);

  const registerRetry = useCallback((fn) => {
    if (typeof fn !== "function") return () => {};
    retryFnsRef.current.add(fn);
    return () => retryFnsRef.current.delete(fn);
  }, []);

  const runRetries = useCallback(() => {
    retryFnsRef.current.forEach((fn) => {
      try {
        fn();
      } catch {
        /* ignore */
      }
    });
  }, []);

  useEffect(() => {
    const onOnline = () => {
      setOnline(true);
      runRetries();
    };
    const onOffline = () => setOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      clearSlowTimers();
    };
  }, [runRetries]);

  const value = useMemo(
    () => ({
      online,
      slow,
      markRequestStart,
      markRequestEnd,
      dismissSlow,
      registerRetry,
      retryNow: runRetries,
    }),
    [online, slow, markRequestStart, markRequestEnd, dismissSlow, registerRetry, runRetries]
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {!online ? <OfflineBanner onRetry={runRetries} /> : null}
      {online && slow ? (
        <div className="sticky top-0 z-[79] px-4 pt-2">
          <SlowNetworkBanner onClose={dismissSlow} />
        </div>
      ) : null}
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkStatusContext);
}
