import { describe, expect, it } from "vitest";

import { filterStaticNav } from "../components/layout/Sidebar.jsx";
import { SIDEBAR_NAV } from "./sidebarNav";

describe("Accounts sidebar navigation", () => {
  it("does not list Accounts Dashboard under Accounting in static nav", () => {
    const finance = SIDEBAR_NAV.find((s) => s.key === "finance");
    const paths = (finance?.children || []).map((c) => c.to);
    expect(paths).not.toContain("/accounts/dashboard");
    expect(paths).toContain("/accounts/settings");
    expect(paths).toContain("/finance/accounts-receivable");
  });

  it("maps top-level Dashboard to accounts dashboard for Accountant users", () => {
    const accountant = {
      role: "Accountant",
      permissions: ["dashboard", "accounts", "masters", "documents", "analytics", "alerts", "settings", "sales"],
    };
    const nav = filterStaticNav(accountant);
    const dashboard = nav.find((s) => s.key === "dashboard");
    expect(dashboard).toBeTruthy();
    expect(dashboard.to).toBe("/");
    const finance = nav.find((s) => s.key === "finance");
    const financePaths = (finance?.children || []).map((c) => c.to);
    expect(financePaths).not.toContain("/accounts/dashboard");
  });
});
