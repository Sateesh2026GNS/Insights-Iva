import { describe, expect, it } from "vitest";
import { shouldShowChatbot } from "./App";

describe("shouldShowChatbot", () => {
  it("shows the shared assistant for operator users on allowed routes", () => {
    expect(shouldShowChatbot({ role: "Operator" }, "/")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/my-job-cards")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/production/my-entry")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/production/dashboard")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/production/work-orders")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/factory-monitor/machine-status")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/iot/live-operations")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/operations")).toBe(true);
  });

  it("hides the assistant on blocked modules and for users without module access", () => {
    expect(shouldShowChatbot({ role: "Operator" }, "/sales/orders")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/store-manager/dashboard")).toBe(false);
    expect(shouldShowChatbot(null, "/")).toBe(false);
  });

  it("shows shared assistant for ERP roles on eligible module routes", () => {
    expect(shouldShowChatbot({ role: "Production Manager", permissions: ["production"] }, "/production/dashboard")).toBe(
      true
    );
    expect(shouldShowChatbot({ role: "Accountant", permissions: ["accounts"] }, "/accounts/dashboard")).toBe(true);
    expect(shouldShowChatbot({ role: "Viewer", permissions: [] }, "/iot/live-operations")).toBe(false);
  });

  it("hides the assistant on shell-less and admin routes", () => {
    expect(shouldShowChatbot({ role: "Operator" }, "/login")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/settings")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/gns-admin")).toBe(false);
  });

  it("shows assistant for admin on dashboard", () => {
    expect(shouldShowChatbot({ role: "Admin" }, "/")).toBe(true);
  });
});
