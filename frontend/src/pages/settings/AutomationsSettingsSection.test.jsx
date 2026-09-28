import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import AutomationsSettingsSection from "./AutomationsSettingsSection";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { id: 1, roles: [{ name: "Operator" }] } }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

describe("AutomationsSettingsSection", () => {
  it("shows admin-only message for non-admin users", () => {
    render(<AutomationsSettingsSection />);
    expect(screen.getByText(/Only tenant administrators/i)).toBeInTheDocument();
  });
});
