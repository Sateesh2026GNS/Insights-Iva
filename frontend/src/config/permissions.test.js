import { describe, it, expect } from "vitest";

import {
  canAccess,
  getModuleForPath,
  isAdmin,
  isProductionManager,
  userCanAccessPath,
  getEffectivePermissions,
  userCanAccess,
} from "./permissions";

describe("canAccess", () => {
  it("grants admins access to any module", () => {
    expect(canAccess("Admin", "production")).toBe(true);
    expect(canAccess("Admin", "accounts")).toBe(true);
  });

  it("restricts non-admin roles to their modules", () => {
    expect(canAccess("HR Manager", "masters")).toBe(true);
    expect(canAccess("HR Manager", "production")).toBe(false);
  });

  it("returns false for unknown roles or missing input", () => {
    expect(canAccess(undefined, "masters")).toBe(false);
    expect(canAccess("Ghost", "masters")).toBe(false);
  });
});

describe("getModuleForPath", () => {
  it("maps nested paths to the longest matching prefix", () => {
    expect(getModuleForPath("/production/orders/5")).toBe("production");
    expect(getModuleForPath("/factory-monitor/lines")).toBe("factoryMonitor");
    expect(getModuleForPath("/")).toBe("dashboard");
  });
});

describe("isAdmin", () => {
  it("detects admins by role name, roles list, or permission", () => {
    expect(isAdmin({ role: "Admin" })).toBe(true);
    expect(isAdmin({ roles: ["Admin"] })).toBe(true);
    expect(isAdmin({ permissions: ["*"] })).toBe(true);
    expect(isAdmin({ role: "Operator", permissions: ["production"] })).toBe(false);
    expect(isAdmin(null)).toBe(false);
  });
});

describe("isProductionManager and userCanAccessPath", () => {
  it("detects Production Manager role", () => {
    expect(isProductionManager({ role: "Production Manager" })).toBe(true);
    expect(isProductionManager({ roles: ["production_manager"] })).toBe(true);
    expect(isProductionManager({ role: "Admin" })).toBe(false);
  });

  it("blocks Production Manager from accessing vendors page", () => {
    const pm = { role: "Production Manager" };
    expect(userCanAccessPath(pm, "/procurement/vendors")).toBe(false);
    expect(userCanAccessPath(pm, "/masters/vendors")).toBe(false);
    expect(userCanAccessPath(pm, "/masters/products")).toBe(true);
  });
});

describe("getEffectivePermissions / userCanAccess", () => {
  it("prefers live API permissions over the static role map", () => {
    const user = { role: "Operator", permissions: ["sales"] };
    expect(getEffectivePermissions(user)).toEqual(["sales"]);
    expect(userCanAccess(user, "sales")).toBe(true);
    expect(userCanAccess(user, "production")).toBe(false);
  });

  it("falls back to the role map when no live permissions exist", () => {
    const user = { role: "HR Manager" };
    expect(userCanAccess(user, "masters")).toBe(true);
    expect(userCanAccess(user, "sales")).toBe(false);
  });

  it("always allows admins", () => {
    expect(userCanAccess({ role: "Admin" }, "anything")).toBe(true);
  });

  it("allows granular permissions to satisfy module access", () => {
    const user = { role: "Accountant", permissions: ["procurement:read"] };
    expect(getEffectivePermissions(user)).toEqual(["procurement:read"]);
    expect(userCanAccess(user, "procurement")).toBe(true);
    expect(userCanAccess(user, "sales")).toBe(false);
  });

  it("falls back to the static role map when there are no live permissions", () => {
    const user = { role: "Accountant", permissions: [] };
    expect(getEffectivePermissions(user)).toContain("accounts");
    expect(getEffectivePermissions(user)).toContain("sales");
    expect(userCanAccess(user, "accounts")).toBe(true);
    expect(userCanAccess(user, "analytics")).toBe(true);
    expect(userCanAccess(user, "inventory")).toBe(false);
    expect(userCanAccess(user, "quality")).toBe(false);
  });

  it("grants Purchase/Procurement Manager inventory access from the static map", () => {
    expect(userCanAccess({ role: "Purchase Manager" }, "inventory")).toBe(true);
    expect(userCanAccess({ role: "Procurement Manager" }, "inventory")).toBe(true);
  });
});

describe("Store Manager settings access", () => {
  const storeManager = {
    role: "Store Manager",
    permissions: ["dashboard", "inventory", "procurement", "masters", "alerts", "documents"],
  };

  it("denies /settings when settings module is missing from live permissions", () => {
    expect(userCanAccessPath(storeManager, "/settings")).toBe(false);
  });

  it("allows /settings when settings module is granted", () => {
    const withSettings = {
      ...storeManager,
      permissions: [...storeManager.permissions, "settings"],
    };
    expect(userCanAccessPath(withSettings, "/settings")).toBe(true);
    expect(userCanAccessPath(withSettings, "/settings/my-account")).toBe(true);
    expect(userCanAccessPath(withSettings, "/settings/users")).toBe(false);
    expect(userCanAccessPath(withSettings, "/settings/company")).toBe(false);
  });

  it("falls back to static role map including settings when API permissions are empty", () => {
    expect(userCanAccessPath({ role: "Store Manager", permissions: [] }, "/settings")).toBe(true);
  });
});
