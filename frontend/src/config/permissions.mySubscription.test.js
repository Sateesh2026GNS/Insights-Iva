import { describe, it, expect } from "vitest";

import { SETTINGS_CATEGORIES } from "../pages/settings/settingsCatalog";
import {
  filterAccessibleSettingsCategories,
  userCanAccessMySubscription,
  userCanAccessPath,
} from "./permissions";

describe("My Subscription admin-only", () => {
  it("allows tenant Admin role on route and section helpers", () => {
    const admin = { role: "Admin" };
    expect(userCanAccessMySubscription(admin)).toBe(true);
    expect(userCanAccessPath(admin, "/settings/subscription")).toBe(true);
  });

  it("denies non-Admin roles even when they have settings module access", () => {
    const roles = [
      { role: "Operator", permissions: ["settings"] },
      { role: "Store Manager", permissions: ["settings"] },
      { role: "Sales Manager", permissions: ["settings", "sales"] },
      { role: "HR Manager", permissions: ["settings", "hr"] },
      { role: "Production Manager", permissions: ["settings", "production"] },
    ];
    for (const user of roles) {
      expect(userCanAccessMySubscription(user)).toBe(false);
      expect(userCanAccessPath(user, "/settings/subscription")).toBe(false);
    }
  });

  it("does not treat SuperAdmin or wildcard permissions as My Subscription access", () => {
    expect(userCanAccessPath({ role: "SuperAdmin", permissions: ["*"] }, "/settings/subscription")).toBe(
      false
    );
    expect(userCanAccessMySubscription({ role: "Operator", permissions: ["*"] })).toBe(false);
  });

  it("includes Subscription in settings nav only for Admin", () => {
    const adminCats = filterAccessibleSettingsCategories(SETTINGS_CATEGORIES, { role: "Admin" });
    expect(adminCats.some((c) => c.id === "subscription")).toBe(true);

    const operatorCats = filterAccessibleSettingsCategories(SETTINGS_CATEGORIES, {
      role: "Operator",
      permissions: ["settings"],
    });
    expect(operatorCats.some((c) => c.id === "subscription")).toBe(false);
  });

  it("does not expose subscription nav while user is unresolved", () => {
    expect(filterAccessibleSettingsCategories(SETTINGS_CATEGORIES, null)).toEqual([]);
    expect(filterAccessibleSettingsCategories(SETTINGS_CATEGORIES, undefined)).toEqual([]);
  });
});
