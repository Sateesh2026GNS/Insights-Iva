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
import { operatorPathAllowed } from "./rbacNavFilters";

describe("canAccess", () => {
  it("grants admins access to any module", () => {
    expect(canAccess("Admin", "production")).toBe(true);
    expect(canAccess("Admin", "accounts")).toBe(true);
  });

  it("restricts non-admin roles to their modules", () => {
    expect(canAccess("HR Manager", "hr")).toBe(true);
    expect(canAccess("HR Manager", "production")).toBe(false);
  });

  it("returns false for unknown roles or missing input", () => {
    expect(canAccess(undefined, "hr")).toBe(false);
    expect(canAccess("Ghost", "hr")).toBe(false);
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
    expect(userCanAccessPath(pm, "/masters/products")).toBe(false);
    expect(userCanAccessPath(pm, "/production/planning")).toBe(true);
    expect(userCanAccessPath(pm, "/procurement/purchase-orders")).toBe(false);
    expect(userCanAccessPath(pm, "/quality/incoming")).toBe(false);
    expect(userCanAccessPath(pm, "/alerts/safety")).toBe(false);
    expect(userCanAccessPath(pm, "/")).toBe(true);
    expect(userCanAccessPath(pm, "/production")).toBe(true);
    expect(userCanAccessPath(pm, "/production/dashboard")).toBe(true);
    expect(userCanAccessPath(pm, "/settings")).toBe(true);
    expect(userCanAccessPath(pm, "/settings/users")).toBe(false);
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
    expect(userCanAccess(user, "hr")).toBe(true);
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
    expect(userCanAccessPath(withSettings, "/settings/subscription")).toBe(false);
  });

  it("falls back to static role map including settings when API permissions are empty", () => {
    expect(userCanAccessPath({ role: "Store Manager", permissions: [] }, "/settings")).toBe(true);
  });

  it("allows Store Manager to open inventory reports and stock ledger", () => {
    expect(userCanAccessPath({ role: "Store Manager", permissions: [] }, "/inventory/reports")).toBe(true);
    expect(userCanAccessPath({ role: "Store Manager", permissions: [] }, "/store/reports")).toBe(true);
    expect(userCanAccessPath({ role: "Store Manager", permissions: [] }, "/inventory/stock-ledger")).toBe(
      true
    );
    expect(userCanAccessPath({ role: "Store Manager", permissions: [] }, "/reports")).toBe(false);
  });

  it("denies sales job card create/edit paths", () => {
    const storeManager = {
      role: "Store Manager",
      permissions: ["dashboard", "inventory", "sales", "procurement"],
    };
    expect(userCanAccessPath(storeManager, "/sales/job-cards/create")).toBe(false);
    expect(userCanAccessPath(storeManager, "/sales/job-cards/42/edit")).toBe(false);
    expect(userCanAccessPath(storeManager, "/my-job-cards")).toBe(true);
  });
});

describe("Work Chat — authenticated common feature", () => {
  it("grants chat module to any authenticated user", () => {
    expect(userCanAccess({ role: "Store Manager", permissions: [] }, "chat")).toBe(true);
    expect(userCanAccess({ role: "Operator", permissions: [] }, "chat")).toBe(true);
    expect(userCanAccess({ role: "Accountant", permissions: [] }, "chat")).toBe(true);
    expect(userCanAccess({ role: "Sales Manager", permissions: [] }, "chat")).toBe(true);
    expect(userCanAccess(null, "chat")).toBe(false);
  });

  it("allows /chat for roles without chat in static permission map", () => {
    const storeManager = { role: "Store Manager", permissions: [] };
    const operator = { role: "Operator", permissions: [] };
    const accountant = { role: "Accountant", permissions: [] };
    expect(userCanAccessPath(storeManager, "/chat")).toBe(true);
    expect(userCanAccessPath(operator, "/chat")).toBe(true);
    expect(userCanAccessPath(accountant, "/chat")).toBe(true);
    expect(userCanAccessPath(null, "/chat")).toBe(false);
  });

  it("does not grant unrelated modules via chat access", () => {
    const operator = { role: "Operator", permissions: [] };
    expect(userCanAccessPath(operator, "/chat")).toBe(true);
    expect(userCanAccessPath(operator, "/sales")).toBe(false);
    expect(userCanAccessPath(operator, "/hr")).toBe(false);
  });
});

describe("Operator production nav", () => {
  const operator = { role: "Operator", permissions: ["dashboard", "production", "alerts"] };

  it("blocks planning and allocation paths", () => {
    expect(operatorPathAllowed("/production/planning")).toBe(false);
    expect(operatorPathAllowed("/production/tasks")).toBe(false);
    expect(operatorPathAllowed("/production/my-machine")).toBe(true);
    expect(operatorPathAllowed("/production/my-entry")).toBe(true);
    expect(operatorPathAllowed("/chat")).toBe(true);
  });

  it("userCanAccessPath denies manager production URLs", () => {
    expect(userCanAccessPath(operator, "/production/planning")).toBe(false);
    expect(userCanAccessPath(operator, "/production/work-orders")).toBe(true);
  });
});

describe("Operator settings access", () => {
  const operator = { role: "Operator", permissions: ["dashboard", "production", "settings"] };

  it("allows /settings home and personal sections", () => {
    expect(userCanAccessPath(operator, "/settings")).toBe(true);
    expect(userCanAccessPath(operator, "/settings/my-account")).toBe(true);
    expect(userCanAccessPath(operator, "/settings/appearance")).toBe(true);
    expect(userCanAccessPath(operator, "/settings/notifications")).toBe(true);
  });

  it("denies admin-only settings sections", () => {
    expect(userCanAccessPath(operator, "/settings/users")).toBe(false);
    expect(userCanAccessPath(operator, "/settings/company")).toBe(false);
    expect(userCanAccessPath(operator, "/settings/ai")).toBe(false);
    expect(userCanAccessPath(operator, "/settings/subscription")).toBe(false);
  });

  it("falls back to static role map with settings when API permissions are empty", () => {
    expect(userCanAccessPath({ role: "Operator", permissions: [] }, "/settings")).toBe(true);
    expect(userCanAccessPath({ role: "Operator", permissions: [] }, "/settings/company")).toBe(false);
  });
});

describe("Quality Control path access", () => {
  const qc = { role: "Quality Control", permissions: [] };

  it("allows quality and materials routes", () => {
    expect(userCanAccessPath(qc, "/dashboard")).toBe(true);
    expect(userCanAccessPath(qc, "/quality")).toBe(true);
    expect(userCanAccessPath(qc, "/quality/defects")).toBe(true);
    expect(userCanAccessPath(qc, "/inventory/raw-materials")).toBe(true);
    expect(userCanAccessPath(qc, "/production/planning")).toBe(true);
    expect(userCanAccessPath(qc, "/settings")).toBe(true);
    expect(userCanAccessPath(qc, "/chat")).toBe(true);
  });

  it("blocks masters, procurement, and inventory admin URLs", () => {
    expect(userCanAccessPath(qc, "/masters/products")).toBe(false);
    expect(userCanAccessPath(qc, "/procurement/purchase-orders")).toBe(false);
    expect(userCanAccessPath(qc, "/inventory/warehouses")).toBe(false);
    expect(userCanAccessPath(qc, "/admin/approvals")).toBe(false);
    expect(userCanAccessPath(qc, "/settings/users")).toBe(false);
  });
});

describe("getDashboardPathForRole", () => {
  it("routes ERP roles to their module home dashboards", async () => {
    const { getDashboardPathForRole } = await import("../utils/roleRedirect");
    expect(getDashboardPathForRole("Admin")).toBe("/");
    expect(getDashboardPathForRole("Production Manager")).toBe("/production/dashboard");
    expect(getDashboardPathForRole("Operator")).toBe("/my-job-cards");
    expect(getDashboardPathForRole("operator")).toBe("/my-job-cards");
    expect(getDashboardPathForRole("Store Manager")).toBe("/inventory/dashboard");
    expect(getDashboardPathForRole("HR Manager")).toBe("/hr");
    expect(getDashboardPathForRole("Sales Manager")).toBe("/sales");
    expect(getDashboardPathForRole("Accountant")).toBe("/accounts/dashboard");
    expect(getDashboardPathForRole("Accounts")).toBe("/accounts/dashboard");
    expect(getDashboardPathForRole("Finance Manager")).toBe("/accounts/dashboard");
    expect(getDashboardPathForRole("Quality Control")).toBe("/dashboard");
  });

  it("routes GNS Super Admin to /gns-admin", async () => {
    const { getDashboardPathForRole } = await import("../utils/roleRedirect");
    expect(getDashboardPathForRole("Super Admin")).toBe("/gns-admin");
    expect(getDashboardPathForRole("GNS Super Admin")).toBe("/gns-admin");
  });
});
