import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import AppShellBottomActionBar from "./AppShellBottomActionBar";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({
    user: { role: "Sales Manager", permissions: ["sales", "masters"] },
    logout: vi.fn(),
  }),
}));

vi.mock("../../context/SettingsContext", () => ({
  default: () => ({ theme: "light", updateTheme: vi.fn() }),
}));

vi.mock("../../config/globalCreateActions", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    getGlobalCreateActionsForUser: () => [{ id: "customer", label: "New Customer", path: "/sales/customers/create" }],
  };
});

describe("AppShellBottomActionBar", () => {
  it("exposes Add control with aria-label and title Add", () => {
    render(
      <MemoryRouter>
        <AppShellBottomActionBar />
      </MemoryRouter>
    );
    const add = screen.getByRole("button", { name: "Add" });
    expect(add.getAttribute("title")).toBe("Add");
  });
});
