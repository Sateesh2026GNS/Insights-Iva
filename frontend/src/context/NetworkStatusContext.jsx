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
});

const SLOW_MS = 4000;

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
  const retryFnsRef = useRef(new Set());

  const clearSlowTimer = () => {
    if (slowTimerRef.current) {
      clearTimeout(slowTimerRef.current);
      slowTimerRef.current = null;
    }
  };

  const markRequestStart = useCallback(() => {
    pendingRef.current += 1;
    if (!slowTimerRef.current) {
      slowTimerRef.current = setTimeout(() => {
        if (pendingRef.current > 0) setSlow(true);
      }, SLOW_MS);
    }
  }, []);

  const markRequestEnd = useCallback(() => {
    pendingRef.current = Math.max(0, pendingRef.current - 1);
    if (pendingRef.current === 0) {
      clearSlowTimer();
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
      clearSlowTimer();
    };
  }, [runRetries]);

  const value = useMemo(
    () => ({
      online,
      slow,
      markRequestStart,
      markRequestEnd,
      registerRetry,
      retryNow: runRetries,
    }),
    [online, slow, markRequestStart, markRequestEnd, registerRetry, runRetries]
  );

  return (
    <NetworkStatusContext.Provider value={value}>
      {!online ? <OfflineBanner onRetry={runRetries} /> : null}
      {online && slow ? (
        <div className="sticky top-0 z-[79] px-4 pt-2">
          <SlowNetworkBanner />
        </div>
      ) : null}
      {children}
    </NetworkStatusContext.Provider>
  );
}

export function useNetworkStatus() {
  return useContext(NetworkStatusContext);
}
