import { describe, expect, it } from "vitest";

import { filterStaticNav } from "../components/layout/Sidebar.jsx";
import { userCanAccessPath } from "./permissions";
import { PRODUCTION_MANAGER_NAV_ITEMS } from "./productionManagerNavConfig";
import { LayoutDashboard, MessageSquare } from "lucide-react";

import { normalizeSidebarBottomOrder, SIDEBAR_NAV } from "./sidebarNav";

describe("normalizeSidebarBottomOrder", () => {
  it("promotes Dashboard children to top-level items above Settings", () => {
    const nav = normalizeSidebarBottomOrder([
      {
        key: "dashboard",
        label: "Dashboard",
        to: "/",
        icon: LayoutDashboard,
        children: [
          { key: "myJobCards", label: "My Job Cards", to: "/my-job-cards", module: "production" },
          { key: "chat", label: "Work Chat", to: "/chat", module: "chat" },
        ],
      },
      { key: "production", label: "Production", children: [{ label: "Planning", to: "/production/planning" }] },
      { key: "meetings", label: "Meetings", to: "/meetings", icon: MessageSquare, module: "meetings" },
      { key: "settings", label: "Settings", to: "/settings" },
    ]);
    const keys = nav.map((s) => s.key);
    expect(keys.indexOf("dashboard")).toBe(0);
    expect(nav.find((s) => s.key === "dashboard")?.children).toBeUndefined();
    expect(nav.find((s) => s.key === "dashboard")?.to).toBe("/");
    expect(keys.slice(keys.indexOf("chat"))).toEqual(["chat", "myJobCards", "meetings", "settings"]);
    expect(keys.filter((k) => k === "chat" || k === "myJobCards" || k === "meetings")).toHaveLength(3);
  });

  it("does not pull Production Job Card Queue into the bottom strip", () => {
    const nav = normalizeSidebarBottomOrder([
      { key: "dashboard", label: "Dashboard", to: "/production/dashboard" },
      {
        key: "production",
        label: "Production Flow",
        children: [{ key: "productionQueue", label: "Job Card Queue", to: "/my-job-cards?dept=production" }],
      },
      { key: "chat", label: "Work Chat", to: "/chat" },
      { key: "settings", label: "Settings", to: "/settings" },
    ]);
    const production = nav.find((s) => s.key === "production");
    expect(production?.children?.some((c) => c.key === "productionQueue")).toBe(true);
    expect(nav.some((s) => s.key === "myJobCards")).toBe(false);
  });
});

describe("Admin sidebar Job Cards visibility", () => {
  const admin = { role: "Admin", permissions: ["*"] };

  it("places Work Chat, My Job Cards, and Meetings immediately above Settings", () => {
    const keys = SIDEBAR_NAV.map((s) => s.key);
    const chatIdx = keys.indexOf("chat");
    const jobCardsIdx = keys.indexOf("myJobCards");
    const meetingsIdx = keys.indexOf("meetings");
    const settingsIdx = keys.indexOf("settings");
    expect(chatIdx).toBeGreaterThan(-1);
    expect(jobCardsIdx).toBe(chatIdx + 1);
    expect(meetingsIdx).toBe(jobCardsIdx + 1);
    expect(settingsIdx).toBe(meetingsIdx + 1);
    expect(keys.indexOf("dashboard")).toBe(0);
    expect(keys.indexOf("dashboard")).toBeLessThan(chatIdx);
    expect(keys.filter((k) => k === "chat" || k === "myJobCards" || k === "meetings")).toHaveLength(3);
  });

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
