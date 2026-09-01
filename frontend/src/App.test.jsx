import { describe, expect, it } from "vitest";
import { shouldShowChatbot } from "./App";

describe("shouldShowChatbot", () => {
  it("shows the chatbot for operator users on production and operations routes", () => {
    expect(shouldShowChatbot({ role: "Operator" }, "/")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/production/tasks")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/production/dashboard")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/production/work-orders")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/factory-monitor/machine-status")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/iot/live-operations")).toBe(true);
    expect(shouldShowChatbot({ role: "Operator" }, "/operations")).toBe(true);
  });

  it("hides the chatbot for non-operator users and other modules", () => {
    expect(shouldShowChatbot({ role: "Accountant" }, "/iot/live-operations")).toBe(false);
    expect(shouldShowChatbot({ role: "Production Manager" }, "/production/dashboard")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/sales/orders")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/store-manager/dashboard")).toBe(false);
  });

  it("hides the chatbot on shell-less and admin routes", () => {
    expect(shouldShowChatbot({ role: "Operator" }, "/login")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/settings")).toBe(false);
    expect(shouldShowChatbot({ role: "Operator" }, "/gns-admin")).toBe(false);
  });
});
