import { describe, expect, it } from "vitest";

import {
  AI_ASSISTANT_MODES,
  erpPageContextLabel,
  isErpAiEligibleRoute,
  resolveErpAiAssistantMode,
  userCanUseRegistryAgent,
} from "./erpAiAssistant";

describe("erpAiAssistant", () => {
  it("eligible routes exclude auth and settings", () => {
    expect(isErpAiEligibleRoute("/sales/orders")).toBe(true);
    expect(isErpAiEligibleRoute("/login")).toBe(false);
    expect(isErpAiEligibleRoute("/settings/profile")).toBe(false);
  });

  it("registry agent requires inventory or sales access", () => {
    expect(userCanUseRegistryAgent({ role: "Sales Manager" })).toBe(true);
    expect(userCanUseRegistryAgent({ role: "Store Manager" })).toBe(true);
    expect(userCanUseRegistryAgent({ role: "HR Manager" })).toBe(false);
    expect(userCanUseRegistryAgent({ role: "Admin" })).toBe(true);
  });

  it("operator mode on allowed operator paths", () => {
    expect(resolveErpAiAssistantMode({ role: "Operator" }, "/production/work-orders")).toBe(
      AI_ASSISTANT_MODES.OPERATOR
    );
    expect(resolveErpAiAssistantMode({ role: "Operator" }, "/sales/orders")).toBe(null);
  });

  it("sales manager gets registry agent on sales pages", () => {
    expect(resolveErpAiAssistantMode({ role: "Sales Manager" }, "/sales/orders")).toBe(
      AI_ASSISTANT_MODES.REGISTRY
    );
  });

  it("store manager gets registry agent on inventory pages", () => {
    expect(resolveErpAiAssistantMode({ role: "Store Manager" }, "/store/reports")).toBe(
      AI_ASSISTANT_MODES.REGISTRY
    );
  });

  it("page context label is derived from path without sensitive data", () => {
    expect(erpPageContextLabel("/sales/orders")).toBe("Sales Orders");
    expect(erpPageContextLabel("/production/work-orders")).toBe("Production / Work Orders");
  });
});
