import { describe, expect, it } from "vitest";

import { isPathActive, isSidebarLinkActive, productionPlanningToolkitLinkActive } from "./sidebarNav";
import { SALES_DASHBOARD_PATH } from "../utils/roleRedirect";
import { SALES_MANAGER_NAV_ITEMS } from "./salesManagerNavConfig";
import { STORE_MANAGER_NAV_ITEMS } from "./storeManagerNavConfig";

const salesChildren = SALES_MANAGER_NAV_ITEMS.find((s) => s.key === "sales").children;

function child(key) {
  return salesChildren.find((c) => c.key === key);
}

function loc(pathname, search = "") {
  return { pathname, search };
}

describe("sidebarNav isPathActive", () => {
  it("does not mark /sales dashboard active on nested sales routes when end is true", () => {
    expect(isPathActive("/sales/quotations", SALES_DASHBOARD_PATH, true)).toBe(false);
    expect(isPathActive("/sales", SALES_DASHBOARD_PATH, true)).toBe(true);
  });

  it("marks nested sales routes active when end is false", () => {
    expect(isPathActive("/sales/quotations", SALES_DASHBOARD_PATH, false)).toBe(true);
  });

  it("ignores query strings when comparing path prefixes", () => {
    expect(isPathActive("/sales/leads", "/sales/leads?followup=due", false)).toBe(true);
  });
});

describe("sidebarNav isSidebarLinkActive — Sales manager children", () => {
  it("highlights only Leads on /sales/leads", () => {
    const location = loc("/sales/leads");
    expect(isSidebarLinkActive(location, child("leads"))).toBe(true);
    expect(isSidebarLinkActive(location, child("createLead"))).toBe(false);
  });

  it("highlights only Create Lead on /sales/leads/new", () => {
    const location = loc("/sales/leads/new");
    expect(isSidebarLinkActive(location, child("leads"))).toBe(false);
    expect(isSidebarLinkActive(location, child("createLead"))).toBe(true);
  });

  it("highlights Create Lead on edit route", () => {
    const location = loc("/sales/leads/42/edit");
    expect(isSidebarLinkActive(location, child("createLead"))).toBe(true);
    expect(isSidebarLinkActive(location, child("leads"))).toBe(false);
  });

  it("highlights only Quotations on /sales/quotations", () => {
    const location = loc("/sales/quotations");
    expect(isSidebarLinkActive(location, child("quotations"))).toBe(true);
    expect(isSidebarLinkActive(location, child("leads"))).toBe(false);
    expect(isSidebarLinkActive(location, child("orders"))).toBe(false);
  });

  it("highlights only Sales Orders on /sales/orders", () => {
    const location = loc("/sales/orders");
    expect(isSidebarLinkActive(location, child("orders"))).toBe(true);
    expect(isSidebarLinkActive(location, child("quotations"))).toBe(false);
  });
});

function storeInventoryToolkitChild(key) {
  const inventory = STORE_MANAGER_NAV_ITEMS.find((n) => n.key === "inventory");
  return inventory?.children?.find((c) => c.key === key);
}

describe("sidebarNav isSidebarLinkActive — Store Manager manufacturing toolkits", () => {
  const inventoryRegister = () => storeInventoryToolkitChild("inventoryRegisterToolkit");
  const rawMaterialTracker = () => storeInventoryToolkitChild("rawMaterialTrackerToolkit");

  it("highlights only Inventory Register when toolkit=inventory_register", () => {
    const location = loc("/production/planning", "?toolkit=inventory_register");
    expect(isSidebarLinkActive(location, inventoryRegister())).toBe(true);
    expect(isSidebarLinkActive(location, rawMaterialTracker())).toBe(false);
  });

  it("highlights only Raw Material Tracker when toolkit=raw_material_tracker", () => {
    const location = loc("/production/planning", "?toolkit=raw_material_tracker");
    expect(isSidebarLinkActive(location, rawMaterialTracker())).toBe(true);
    expect(isSidebarLinkActive(location, inventoryRegister())).toBe(false);
  });

  it("defaults to Inventory Register when toolkit param is missing (refresh / bare URL)", () => {
    const location = loc("/production/planning");
    expect(isSidebarLinkActive(location, inventoryRegister())).toBe(true);
    expect(isSidebarLinkActive(location, rawMaterialTracker())).toBe(false);
  });

  it("does not treat pathname-only planning links as active when toolkit is set", () => {
    const location = loc("/production/planning", "?toolkit=raw_material_tracker");
    const barePlanning = { to: "/production/planning", end: false };
    expect(isSidebarLinkActive(location, barePlanning)).toBe(false);
  });
});

describe("productionPlanningToolkitLinkActive", () => {
  it("matches by explicit toolkit id", () => {
    expect(
      productionPlanningToolkitLinkActive(
        "/production/planning",
        "?toolkit=raw_material_tracker",
        "/production/planning",
        "?toolkit=raw_material_tracker",
        "raw_material_tracker"
      )
    ).toBe(true);
    expect(
      productionPlanningToolkitLinkActive(
        "/production/planning",
        "?toolkit=raw_material_tracker",
        "/production/planning",
        "?toolkit=inventory_register",
        "inventory_register"
      )
    ).toBe(false);
  });
});
