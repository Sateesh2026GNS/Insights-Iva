/** Development-only navigation timing (no secrets). */

export function markNavigationStart(label) {
  if (!import.meta.env.DEV || typeof performance === "undefined") return;
  performance.mark(`nav:${label}:start`);
}

export function markNavigationEnd(label) {
  if (!import.meta.env.DEV || typeof performance === "undefined") return;
  const start = `nav:${label}:start`;
  const end = `nav:${label}:end`;
  try {
    performance.mark(end);
    performance.measure(`nav:${label}`, start, end);
  } catch {
    /* ignore missing start mark */
  }
}
