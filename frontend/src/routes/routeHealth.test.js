import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HR_PLACEHOLDER_PATHS } from "../config/hrRouteMeta";
import { HR_SIDEBAR_ITEMS } from "../config/hrSidebarNav";
import { SIDEBAR_NAV } from "../config/sidebarNav";
import { STORE_MANAGER_NAV_ITEMS } from "../config/storeManagerNavConfig";

const __dirname = dirname(fileURLToPath(import.meta.url));
const routesDir = __dirname;
const srcRoot = resolve(routesDir, "..");

function read(relPath) {
  return readFileSync(resolve(routesDir, relPath), "utf8");
}

function extractAppRoutePaths(appRoutesSource) {
  const paths = new Set();
  const re = /path="([^"]+)"/g;
  let match;
  while ((match = re.exec(appRoutesSource))) {
    paths.add(match[1]);
  }
  for (const placeholder of HR_PLACEHOLDER_PATHS) {
    paths.add(placeholder);
  }
  return paths;
}

function extractLazyImportPaths(lazySource) {
  return [...lazySource.matchAll(/import\(["'](\.\.\/[^"']+)["']\)/g)].map((m) => m[1]);
}

function resolveLazyFile(importPath) {
  const base = resolve(routesDir, importPath);
  const candidates = [`${base}.jsx`, `${base}.js`, join(base, "index.jsx")];
  return candidates.find((p) => existsSync(p));
}

function flattenNav(nodes, acc = []) {
  for (const node of nodes || []) {
    if (node.to) acc.push(node.to);
    if (node.children?.length) flattenNav(node.children, acc);
  }
  return acc;
}

function pathIsCovered(navPath, routePaths) {
  if (routePaths.has(navPath)) return true;
  // Dynamic routes: /sales/orders/:id covers /sales/orders conceptually
  const segments = navPath.split("/").filter(Boolean);
  for (const route of routePaths) {
    const routeSegs = route.split("/").filter(Boolean);
    if (routeSegs.length !== segments.length) continue;
    let ok = true;
    for (let i = 0; i < segments.length; i += 1) {
      const rs = routeSegs[i];
      const ns = segments[i];
      if (rs.startsWith(":")) continue;
      if (rs !== ns) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  // Prefix coverage for list pages with child CRUD routes
  const parent = navPath;
  for (const route of routePaths) {
    if (route === parent || route.startsWith(`${parent}/`)) return true;
  }
  return false;
}

describe("route health", () => {
  const lazySource = read("lazyPages.jsx");
  const appRoutesSource = read("AppRoutes.jsx");
  const routePaths = extractAppRoutePaths(appRoutesSource);
  const lazyImports = extractLazyImportPaths(lazySource);

  it("every lazy import resolves to an existing page file", () => {
    const missing = lazyImports.filter((p) => !resolveLazyFile(p));
    expect(missing).toEqual([]);
  });

  it("registers core sales and job card routes", () => {
    const required = [
      "/my-job-cards",
      "/sales/job-cards/create",
      "/sales/job-cards/:id/edit",
      "/sales/job-cards/:id",
      "/sales/orders/:id",
      "/job-cards/:orderId",
      "/accounts/gst",
      "/accounts/dashboard",
      "/accounts/settings",
    ];
    for (const path of required) {
      expect(routePaths.has(path)).toBe(true);
    }
  });

  it("registers 404 fallback", () => {
    expect(routePaths.has("*")).toBe(true);
  });

  it("sidebar navigation targets resolve to registered routes", () => {
    const navPaths = [...new Set(flattenNav(SIDEBAR_NAV).concat(flattenNav(HR_SIDEBAR_ITEMS)))];
    const uncovered = navPaths.filter((p) => !pathIsCovered(p, routePaths));
    expect(uncovered).toEqual([]);
  });

  it("store manager sidebar navigation targets resolve to registered routes", () => {
    const navPaths = [...new Set(flattenNav(STORE_MANAGER_NAV_ITEMS))];
    const uncovered = navPaths
      .map((p) => p.split("?")[0])
      .filter((p) => !pathIsCovered(p, routePaths));
    expect(uncovered).toEqual([]);
  });

  it("does not redirect sales order create to job card create", () => {
    expect(appRoutesSource).not.toMatch(
      /path="\/sales\/orders\/create"[^>]*Navigate to="\/sales\/job-cards\/create"/
    );
  });
});
