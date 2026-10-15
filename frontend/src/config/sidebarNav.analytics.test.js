import { describe, expect, it } from "vitest";

import { filterStaticNav } from "../components/layout/Sidebar.jsx";
import { ROLE_PERMISSIONS } from "./permissions";

function analyticsPaths(user) {
  const nav = filterStaticNav(user);
  const section = nav.find((s) => s.key === "analytics");
  return (section?.children || []).map((c) => c.to);
}

const ALL_KPI_PATHS = [
  "/analytics/executive",
  "/analytics/live",
  "/analytics/production",
  "/analytics/inventory",
  "/analytics/sales",
  "/analytics/finance",
];

describe("Analytics sidebar visibility", () => {
  it("shows all six dashboards for Admin", () => {
    const paths = analyticsPaths({ role: "Admin", permissions: ["*"] });
    expect(paths).toEqual(ALL_KPI_PATHS);
  });

  it("shows only Executive Dashboard and Finance KPI for Accountant", () => {
    const paths = analyticsPaths({
      role: "Accountant",
      permissions: ROLE_PERMISSIONS.Accountant,
    });
    expect(paths).toEqual(["/analytics/executive", "/analytics/finance"]);
    expect(paths).not.toContain("/analytics/production");
    expect(paths).not.toContain("/analytics/inventory");
    expect(paths).not.toContain("/analytics/sales");
    expect(paths).not.toContain("/analytics/live");
  });

  it("hides domain KPI items for HR Manager who only has the analytics module", () => {
    const paths = analyticsPaths({
      role: "HR Manager",
      permissions: ROLE_PERMISSIONS["HR Manager"],
    });
    expect(paths).toEqual(["/analytics/executive"]);
  });
});
