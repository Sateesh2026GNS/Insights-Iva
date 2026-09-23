/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const logoutMock = vi.fn().mockResolvedValue(undefined);
const navigateMock = vi.fn();

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ logout: logoutMock }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { SettingsSignOutSection } from "./settingsUi";

describe("SettingsSignOutSection", () => {
  beforeEach(() => {
    logoutMock.mockClear();
    navigateMock.mockClear();
  });

  it("renders Logout button with sign-out label", () => {
    render(
      <MemoryRouter>
        <SettingsSignOutSection />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: /sign out/i })).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("opens confirmation and runs logout flow on confirm", async () => {
    render(
      <MemoryRouter>
        <SettingsSignOutSection />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    const confirm = await screen.findByRole("button", { name: "Sign Out" });
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(logoutMock).toHaveBeenCalledWith({ allDevices: false });
      expect(navigateMock).toHaveBeenCalledWith("/login", { replace: true });
    });
  });
});
