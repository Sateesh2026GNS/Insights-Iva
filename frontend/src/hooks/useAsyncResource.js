/**
 * Shared async page-load helper for module screens.
 * Use with ErrorState / OfflineState / SkeletonTable / EmptyState / NoResultsState.
 *
 * Example:
 *   const { loading, error, data, reload, online } = useAsyncResource(fetcher, []);
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { useNetworkStatus } from "../context/NetworkStatusContext";
import { classifyApiError } from "../utils/apiError";
import usePageRefresh from "./usePageRefresh";

export default function useAsyncResource(fetcher, deps = []) {
  const { online, markRequestStart, markRequestEnd, registerRetry } = useNetworkStatus();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorObj, setErrorObj] = useState(null);
  const [data, setData] = useState(null);
  const lastErrRef = useRef(null);

  const reload = useCallback(async (opts = {}) => {
    const soft = opts === true || opts?.soft === true;
    if (!soft) setLoading(true);
    setError("");
    setErrorObj(null);
    lastErrRef.current = null;
    markRequestStart();
    try {
      const result = await fetcher();
      setData(result);
      return result;
    } catch (err) {
      lastErrRef.current = err;
      const classified = classifyApiError(err, "Failed to load data. Please try again.");
      if (!soft) {
        setError(classified.message);
        setErrorObj(err);
      }
      throw err;
    } finally {
      markRequestEnd();
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const softReload = useCallback(() => reload({ soft: true }), [reload]);

  useEffect(() => {
    reload().catch(() => {});
  }, [reload]);

  useEffect(() => registerRetry(reload), [registerRetry, reload]);
  usePageRefresh(softReload);

  return {
    loading,
    error,
    errorObj,
    data,
    setData,
    reload,
    softReload,
    online,
    isOfflineError: Boolean(error) && (!online || classifyApiError(lastErrRef.current).type === "network"),
    isPermissionError: classifyApiError(lastErrRef.current).type === "permission",
  };
}
