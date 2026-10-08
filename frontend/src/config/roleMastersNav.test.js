import { describe, expect, it } from "vitest";

import { filterStaticNav } from "../components/layout/Sidebar.jsx";
import { SALES_MANAGER_NAV_ITEMS } from "./salesManagerNavConfig";
import { STORE_MANAGER_NAV_ITEMS } from "./storeManagerNavConfig";
import { ROLE_MASTERS_NAV_CHILDREN, ROLE_MASTERS_NAV_PATHS } from "./roleMastersNav";

function mastersChildrenFromNav(navItems) {
  const masters = navItems.find((n) => n.key === "masters");
  return (masters?.children || []).map((c) => ({ label: c.label, to: c.to }));
}

describe("ROLE_MASTERS_NAV_CHILDREN", () => {
  it("defines Customers, Vendors, Products in order", () => {
    expect(ROLE_MASTERS_NAV_CHILDREN.map((c) => c.label)).toEqual([
      "Customers",
      "Vendors",
      "Products",
    ]);
    expect(ROLE_MASTERS_NAV_PATHS).toEqual([
      "/sales/customers",
      "/procurement/vendors",
      "/masters/products",
    ]);
  });
});

describe("role Masters sidebar — Sales Manager", () => {
  it("exposes all three masters links under Masters only", () => {
    expect(mastersChildrenFromNav(SALES_MANAGER_NAV_ITEMS)).toEqual(
      ROLE_MASTERS_NAV_CHILDREN.map((c) => ({ label: c.label, to: c.to }))
    );
    const sales = SALES_MANAGER_NAV_ITEMS.find((n) => n.key === "sales");
    const salesPaths = (sales?.children || []).map((c) => c.to);
    expect(salesPaths).not.toContain("/sales/customers");
  });
});

describe("role Masters sidebar — Store Manager", () => {
  it("exposes all three masters links", () => {
    expect(mastersChildrenFromNav(STORE_MANAGER_NAV_ITEMS)).toEqual(
      ROLE_MASTERS_NAV_CHILDREN.map((c) => ({ label: c.label, to: c.to }))
    );
  });
});

describe("role Masters sidebar — Accountant", () => {
  it("shows Customers, Vendors, Products under Masters via static nav", () => {
    const accountant = {
      role: "Accountant",
      permissions: ["dashboard", "accounts", "masters", "documents", "analytics", "alerts", "settings", "sales"],
    };
    const nav = filterStaticNav(accountant);
    const masters = nav.find((s) => s.key === "masters");
    const labels = (masters?.children || []).map((c) => c.label);
    expect(labels).toContain("Customers");
    expect(labels).toContain("Vendors");
    expect(labels).toContain("Products");
    expect(labels).not.toContain("Bill of Materials (BOM)");
  });
});
