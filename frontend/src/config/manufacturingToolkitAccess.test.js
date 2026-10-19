import { describe, expect, it } from "vitest";

import {
  STORE_MANAGER_MANUFACTURING_TOOLKIT_IDS,
  isStoreManufacturingToolkitUser,
  manufacturingToolkitIdsForUser,
  normalizeManufacturingToolkitId,
  storeManagerMayAccessProductionPlanning,
  userCanAccessManufacturingToolkit,
} from "./manufacturingToolkitAccess";
import { userCanAccessPath } from "./permissions";

describe("manufacturingToolkitAccess", () => {
  const storeManager = { role: "Store Manager", permissions: ["inventory"] };
  const productionManager = { role: "Production Manager", permissions: ["production"] };

  it("limits Store Manager to inventory register and raw material tracker", () => {
    expect(isStoreManufacturingToolkitUser(storeManager)).toBe(true);
    expect(manufacturingToolkitIdsForUser(storeManager)).toEqual(
      STORE_MANAGER_MANUFACTURING_TOOLKIT_IDS
    );
    expect(userCanAccessManufacturingToolkit(storeManager, "inventory_register")).toBe(true);
    expect(userCanAccessManufacturingToolkit(storeManager, "issue_log")).toBe(false);
    expect(normalizeManufacturingToolkitId(storeManager, "issue_log")).toBe("inventory_register");
  });

  it("allows Production Manager full toolkit list", () => {
    expect(isStoreManufacturingToolkitUser(productionManager)).toBe(false);
    expect(manufacturingToolkitIdsForUser(productionManager)).toBeNull();
    expect(userCanAccessManufacturingToolkit(productionManager, "issue_log")).toBe(true);
  });

  it("grants Store Manager route access to production planning only", () => {
    expect(storeManagerMayAccessProductionPlanning(storeManager)).toBe(true);
    expect(userCanAccessPath(storeManager, "/production/planning")).toBe(true);
    expect(userCanAccessPath(storeManager, "/production/schedule")).toBe(false);
    expect(userCanAccessPath(productionManager, "/production/planning")).toBe(true);
  });
});
