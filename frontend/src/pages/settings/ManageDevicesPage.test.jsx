/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const fetchDeviceSessions = vi.fn();
const revokeDeviceSession = vi.fn();
const revokeAllDeviceSessions = vi.fn();
const logoutMock = vi.fn().mockResolvedValue(undefined);
const addToast = vi.fn();
const network = { online: true };

vi.mock("../../api/sessionsApi", () => ({
  fetchDeviceSessions: (...args) => fetchDeviceSessions(...args),
  revokeDeviceSession: (...args) => revokeDeviceSession(...args),
  revokeAllDeviceSessions: (...args) => revokeAllDeviceSessions(...args),
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ logout: logoutMock }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast }),
}));

vi.mock("../../context/NetworkStatusContext", () => ({
  useNetworkStatus: () => network,
}));

import ManageDevicesPage from "./ManageDevicesPage";

const current = {
  id: "sid-current",
  device_name: "Chrome on Windows",
  browser: "Chrome 120",
  operating_system: "Windows",
  device_type: "Desktop",
  login_at: "2026-10-15T06:00:00Z",
  last_active_at: "2026-10-15T07:00:00Z",
  is_current: true,
};

const other = {
  id: "sid-other",
  device_name: "Safari on iOS",
  browser: "Safari 17",
  operating_system: "iOS",
  device_type: "Mobile",
  login_at: "2026-10-14T06:00:00Z",
  last_active_at: "2026-10-14T08:00:00Z",
  is_current: false,
};

function renderPage() {
  return render(
    <MemoryRouter>
      <ManageDevicesPage />
    </MemoryRouter>,
  );
}

describe("ManageDevicesPage", () => {
  beforeEach(() => {
    fetchDeviceSessions.mockReset();
    revokeDeviceSession.mockReset();
    revokeAllDeviceSessions.mockReset();
    logoutMock.mockClear();
    addToast.mockClear();
    network.online = true;
  });

  it("shows a loading state then the current session", async () => {
    let resolveLoad;
    fetchDeviceSessions.mockReturnValue(
      new Promise((resolve) => {
        resolveLoad = resolve;
      }),
    );
    renderPage();
    expect(screen.getByText(/Loading sessions/i)).toBeTruthy();
    resolveLoad({ current, others: [], total_active: 1 });
    expect(await screen.findByText("Chrome on Windows")).toBeTruthy();
    expect(screen.getByText("Current session")).toBeTruthy();
    expect(screen.getByText("No other devices are signed in.")).toBeTruthy();
    expect(screen.queryByText(/refresh_token|access_token/i)).toBeNull();
  });

  it("shows an empty state when there are no sessions", async () => {
    fetchDeviceSessions.mockResolvedValue({ current: null, others: [], total_active: 0 });
    renderPage();
    expect(await screen.findByText("No active sessions")).toBeTruthy();
  });

  it("shows an error state when the list API fails", async () => {
    fetchDeviceSessions.mockRejectedValue({ response: { data: { detail: "Unable to load active sessions." } } });
    renderPage();
    expect(await screen.findByText(/Unable to load active sessions/i)).toBeTruthy();
  });

  it("confirms individual logout and ignores a second click while busy", async () => {
    fetchDeviceSessions
      .mockResolvedValueOnce({ current, others: [other], total_active: 2 })
      .mockResolvedValue({ current, others: [], total_active: 1 });
    let finishRevoke;
    revokeDeviceSession.mockReturnValue(
      new Promise((resolve) => {
        finishRevoke = resolve;
      }),
    );
    renderPage();
    expect(await screen.findByText("Safari on iOS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(await screen.findByRole("heading", { name: "Log out of this session" })).toBeTruthy();
    const confirmButtons = screen.getAllByRole("button", { name: "Log out" });
    const confirm = confirmButtons.at(-1);
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(revokeDeviceSession).toHaveBeenCalledTimes(1));
    expect(revokeDeviceSession).toHaveBeenCalledWith("sid-other");
    finishRevoke({ message: "Signed out of that device.", current_revoked: false });
    await waitFor(() => expect(addToast).toHaveBeenCalledWith("Signed out of that device.", "success"));
    expect(logoutMock).not.toHaveBeenCalled();
  });

  it("confirms logout-all and signs the current browser out", async () => {
    fetchDeviceSessions.mockResolvedValue({ current, others: [other], total_active: 2 });
    revokeAllDeviceSessions.mockResolvedValue({ current_revoked: true, message: "Signed out from all devices." });
    renderPage();
    expect(await screen.findByText("Safari on iOS")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Log out from all devices" }));
    expect(await screen.findByRole("heading", { name: "Log out from all devices" })).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Log out" }).at(-1));
    await waitFor(() => {
      expect(revokeAllDeviceSessions).toHaveBeenCalledTimes(1);
      expect(logoutMock).toHaveBeenCalledWith({ allDevices: true });
      expect(addToast).toHaveBeenCalledWith("Signed out from all devices.", "success");
    });
  });
});
