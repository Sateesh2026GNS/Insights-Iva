import { describe, expect, it } from "vitest";

import {
  AI_ASSISTANT_MODES,
  erpPageContextLabel,
  isErpAiEligibleRoute,
  resolveErpAiAssistantMode,
  userCanUseSharedAgent,
} from "./erpAiAssistant";

describe("erpAiAssistant", () => {
  it("eligible routes exclude auth and settings", () => {
    expect(isErpAiEligibleRoute("/sales/orders")).toBe(true);
    expect(isErpAiEligibleRoute("/login")).toBe(false);
    expect(isErpAiEligibleRoute("/settings/profile")).toBe(false);
  });

  it("shared agent is available for all primary ERP roles", () => {
    expect(userCanUseSharedAgent({ role: "Sales Manager" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "Store Manager" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "Operator" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "HR Manager" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "Production Manager" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "Quality Control" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "Accountant" })).toBe(true);
    expect(userCanUseSharedAgent({ role: "Admin" })).toBe(true);
  });

  it("operator gets shared mode on allowed operator paths", () => {
    expect(resolveErpAiAssistantMode({ role: "Operator" }, "/production/work-orders")).toBe(
      AI_ASSISTANT_MODES.SHARED
    );
    expect(resolveErpAiAssistantMode({ role: "Operator" }, "/sales/orders")).toBe(null);
  });

  it("sales manager gets shared agent on sales pages", () => {
    expect(resolveErpAiAssistantMode({ role: "Sales Manager" }, "/sales/orders")).toBe(
      AI_ASSISTANT_MODES.SHARED
    );
  });

  it("store manager gets shared agent on inventory pages", () => {
    expect(resolveErpAiAssistantMode({ role: "Store Manager" }, "/store/reports")).toBe(
      AI_ASSISTANT_MODES.SHARED
    );
  });

  it("page context label is derived from path without sensitive data", () => {
    expect(erpPageContextLabel("/sales/orders")).toBe("Sales Orders");
    expect(erpPageContextLabel("/production/work-orders")).toBe("Production / Work Orders");
  });
});
