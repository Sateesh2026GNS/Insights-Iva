import { invalidateReferenceCache } from "./referenceDataCache";

/**
 * Registry for the global bottom-right Refresh control.
 * Pages register their data reload functions; the button awaits them.
 */

const handlers = new Map();
let nextId = 1;
let refreshInProgress = false;
let refreshGeneration = 0;

/**
 * @param {() => void | Promise<void>} handler
 * @returns {() => void} unsubscribe
 */
export function registerPageRefreshHandler(handler) {
  if (typeof handler !== "function") return () => {};
  const id = nextId++;
  handlers.set(id, handler);
  return () => {
    handlers.delete(id);
  };
}

export function getPageRefreshHandlerCount() {
  return handlers.size;
}

/** True while the global Refresh button is running registered loaders. */
export function isPageRefreshInProgress() {
  return refreshInProgress;
}

/** Monotonic counter bumped on each refresh — used to bust HTTP caches. */
export function getPageRefreshGeneration() {
  return refreshGeneration;
}

/**
 * Run all registered page refresh handlers in parallel.
 * Rejects if any handler throws (existing page data should remain).
 */
export async function runPageRefresh() {
  const list = [...handlers.values()];
  if (!list.length) {
    return { count: 0 };
  }

  refreshGeneration += 1;
  invalidateReferenceCache();
  refreshInProgress = true;
  try {
    const results = await Promise.allSettled(
      list.map((fn) => Promise.resolve().then(() => fn()))
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length) {
      const reason = failed[0].reason;
      const message =
        reason?.response?.data?.detail ||
        reason?.response?.data?.message ||
        reason?.message ||
        "Failed to refresh. Please try again.";
      const err = reason instanceof Error ? reason : new Error(String(message));
      if (!(reason instanceof Error)) err.message = String(message);
      throw err;
    }

    return { count: list.length };
  } finally {
    refreshInProgress = false;
  }
}

export const PAGE_REFRESH_EVENT = "gns:page-refresh";
export const PAGE_REFRESH_BLINK_CLASS = "page-refresh-blink";
export const PAGE_REFRESH_BLINK_MS = 320;

function resolvePageRefreshRoot() {
  if (typeof document === "undefined") return null;
  return (
    document.getElementById("main-content") ||
    document.querySelector("[data-page-refresh-root]") ||
    document.querySelector("main") ||
    document.querySelector(".ap-content") ||
    null
  );
}

/**
 * Play a single soft opacity blink on the current page surface.
 * Does not reload the browser — visual feedback only.
 */
export function playPageRefreshBlink() {
  const root = resolvePageRefreshRoot();
  if (!root) return;

  root.classList.remove(PAGE_REFRESH_BLINK_CLASS);
  // Restart CSS animation if the class was already applied recently.
  // eslint-disable-next-line no-unused-expressions
  root.offsetWidth;
  root.classList.add(PAGE_REFRESH_BLINK_CLASS);

  const clear = () => {
    root.classList.remove(PAGE_REFRESH_BLINK_CLASS);
    root.removeEventListener("animationend", onEnd);
  };
  const onEnd = (event) => {
    if (event.target !== root) return;
    clear();
  };
  root.addEventListener("animationend", onEnd);
  window.setTimeout(clear, PAGE_REFRESH_BLINK_MS + 80);
}

/** Notify any legacy listeners; prefer registerPageRefreshHandler for awaitable refresh. */
export function emitPageRefreshEvent(detail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PAGE_REFRESH_EVENT, { detail }));
}
