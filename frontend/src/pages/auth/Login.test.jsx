/** @vitest-environment jsdom */
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";

import Login from "./Login";

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ login: vi.fn() }),
}));

vi.mock("../../api/authApi", () => ({
  login: vi.fn(),
  getLoginErrorMessage: vi.fn((_err, fallback) => fallback),
}));

vi.mock("../../utils/serverWakeup", () => ({
  triggerServerWakeup: vi.fn(),
}));

describe("Login role select", () => {
  it("does not render a duplicate decorative chevron beside the role field", () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );
    const roleSelect = screen.getByRole("combobox", { name: "Role" });
    const fieldWrap = roleSelect.parentElement;
    expect(fieldWrap?.querySelector(":scope > .pointer-events-none.absolute.right-3")).toBeNull();
    expect(roleSelect.className).toMatch(/appearance-none/);
  });
});
