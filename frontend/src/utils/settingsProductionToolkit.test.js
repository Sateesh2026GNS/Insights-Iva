import { describe, expect, it } from "vitest";

import {
  formatSettingsToolkitHeroDate,
  useProductionManagerSettingsToolkit,
} from "./settingsProductionToolkit";

describe("settingsProductionToolkit", () => {
  it("enables toolkit layout for Production Manager but not Admin", () => {
    expect(useProductionManagerSettingsToolkit({ role: "Production Manager" })).toBe(true);
    expect(useProductionManagerSettingsToolkit({ role: "Admin" })).toBe(false);
    expect(
      useProductionManagerSettingsToolkit({ role: "Admin", roles: ["production_manager"] }),
    ).toBe(false);
  });

  it("formats hero date for mtk-hero meta", () => {
    const label = formatSettingsToolkitHeroDate(new Date("2025-04-23T12:00:00"));
    expect(label).toMatch(/Wednesday/);
    expect(label).toMatch(/2025/);
  });
});
