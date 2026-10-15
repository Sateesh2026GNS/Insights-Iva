import { describe, expect, it } from "vitest";

import { getBreadcrumbTrail, getPageTitle } from "./Breadcrumbs";

const ANALYTICS_PAGES = [
  {
    path: "/analytics/executive",
    title: "Executive Dashboard",
    trail: ["Dashboard", "Analytics", "Executive Dashboard"],
  },
  {
    path: "/analytics/live",
    title: "Live Dashboard",
    trail: ["Dashboard", "Analytics", "Live Dashboard"],
  },
  {
    path: "/analytics/production",
    title: "Production KPI",
    trail: ["Dashboard", "Analytics", "Production"],
  },
  {
    path: "/analytics/inventory",
    title: "Inventory KPI",
    trail: ["Dashboard", "Analytics", "Inventory"],
  },
  {
    path: "/analytics/sales",
    title: "Sales KPI",
    trail: ["Dashboard", "Analytics", "Sales"],
  },
  {
    path: "/analytics/finance",
    title: "Finance KPI",
    trail: ["Dashboard", "Analytics", "Finance"],
  },
];

describe("Analytics navbar title and breadcrumbs", () => {
  it.each(ANALYTICS_PAGES)("$title appears once as the navbar title", ({ path, title }) => {
    expect(getPageTitle(path)).toBe(title);
  });

  it.each(ANALYTICS_PAGES)("$title keeps Home > Analytics > page breadcrumb", ({ path, trail }) => {
    expect(getBreadcrumbTrail(path).map((item) => item.label)).toEqual(trail);
  });
});
