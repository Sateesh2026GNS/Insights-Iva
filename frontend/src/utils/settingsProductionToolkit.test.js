import { describe, expect, it } from "vitest";

import {
  formatSettingsToolkitHeroDate,
  useProductionManagerSettingsToolkit,
} from "./settingsProductionToolkit";

describe("settingsProductionToolkit", () => {
  it("enables Process Checklist toolkit layout for every settings role", () => {
    expect(useProductionManagerSettingsToolkit({ role: "Production Manager" })).toBe(true);
    expect(useProductionManagerSettingsToolkit({ role: "Admin" })).toBe(true);
    expect(useProductionManagerSettingsToolkit({ role: "Store Manager" })).toBe(true);
    expect(useProductionManagerSettingsToolkit({ role: "HR Manager" })).toBe(true);
  });

  it("formats hero date for mtk-hero meta", () => {
    const label = formatSettingsToolkitHeroDate(new Date("2025-04-23T12:00:00"));
    expect(label).toMatch(/Wednesday/);
    expect(label).toMatch(/2025/);
  });
});
