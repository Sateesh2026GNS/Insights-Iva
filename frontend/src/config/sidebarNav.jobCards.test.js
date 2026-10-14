import { describe, expect, it } from "vitest";

import { filterStaticNav } from "../components/layout/Sidebar.jsx";
import { userCanAccessPath } from "./permissions";
import { PRODUCTION_MANAGER_NAV_ITEMS } from "./productionManagerNavConfig";

describe("Admin sidebar Job Cards visibility", () => {
  const admin = { role: "Admin", permissions: ["*"] };

  it("includes the canonical My Job Cards top-level item for Admin", () => {
    const nav = filterStaticNav(admin);
    const jobCards = nav.find((s) => s.key === "myJobCards");
    expect(jobCards).toBeTruthy();
    expect(jobCards.label).toBe("My Job Cards");
    expect(jobCards.to).toBe("/my-job-cards");
    expect(nav.filter((s) => s.key === "myJobCards")).toHaveLength(1);
  });

  it("allows Admin to open the Job Cards route directly", () => {
    expect(userCanAccessPath(admin, "/my-job-cards")).toBe(true);
    expect(userCanAccessPath(admin, "/my-job-cards/42")).toBe(true);
  });

  it("keeps My Job Cards for Operator (operatorOnly queue entry)", () => {
    const operator = { role: "Operator", permissions: ["dashboard", "production"] };
    const nav = filterStaticNav(operator);
    expect(nav.some((s) => s.key === "myJobCards")).toBe(true);
  });

  it("does not expose My Job Cards without workflow module access", () => {
    const hrOnly = {
      role: "HR Manager",
      permissions: ["dashboard", "hr", "analytics", "alerts", "documents", "meetings", "settings"],
    };
    const nav = filterStaticNav(hrOnly);
    expect(nav.some((s) => s.key === "myJobCards")).toBe(false);
    expect(userCanAccessPath(hrOnly, "/my-job-cards")).toBe(false);
  });

  it("does not add a duplicate top-level item for Production Manager nav", () => {
    const pmNav = PRODUCTION_MANAGER_NAV_ITEMS;
    expect(pmNav.some((s) => s.key === "myJobCards")).toBe(false);
    const paths = pmNav.flatMap((s) => (s.children || []).map((c) => c.to));
    expect(paths.some((p) => p?.includes("/my-job-cards"))).toBe(true);
  });
});
