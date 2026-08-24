import { operatorPathAllowed } from "../config/rbacNavFilters";

function normalizePath(pathname) {
  return (pathname || "/").replace(/\/+$/, "") || "/";
}

/** Client-side toggles from Settings → AI & LLM (defaults on). */
export function isAiCopilotEnabled() {
  try {
    const cfg = JSON.parse(localStorage.getItem("gns-ai-settings") || "{}");
    if (cfg.enabled === false) return false;
    if (cfg.copilot === false) return false;
  } catch {
    /* ignore */
  }
  return true;
}

/** Routes where the operator floating AI assistant may appear. */
export function isOperatorAiRoute(pathname) {
  const path = normalizePath(pathname);
  if (operatorPathAllowed(path)) return true;
  return (
    path === "/operations" ||
    path.startsWith("/operations/") ||
    path === "/iot" ||
    path.startsWith("/iot/")
  );
}
