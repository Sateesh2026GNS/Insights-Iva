import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import MachineStatus from "./MachineStatus";

const mockUser = { id: 1, full_name: "Test User", role: "admin" };
vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: mockUser }),
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => "tenant-1",
}));

vi.mock("../../hooks/usePageRefresh", () => ({
  default: vi.fn(),
}));

const mockAddToast = vi.fn();
vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: mockAddToast }),
}));

vi.mock("../../api/productionApi", () => ({
  getMachines: vi.fn(() =>
    Promise.resolve({
      data: [
        { id: 1, code: "MCH001", name: "CNC Milling 1", status: "running", efficiency_pct: 92, todays_output: 150 },
        { id: 2, code: "MCH002", name: "Lathe Machine 2", status: "idle", efficiency_pct: 0, todays_output: 0 },
      ],
    })
  ),
  getMachineSummary: vi.fn(() =>
    Promise.resolve({
      data: {
        total_machines: 2,
        running: 1,
        idle: 1,
        maintenance: 0,
        breakdown: 0,
        offline: 0,
        utilization_pct: 50,
        todays_production: 150,
      },
    })
  ),
  getMachineDetail: vi.fn(() => Promise.resolve({ data: {} })),
  updateMachineStatus: vi.fn(() => Promise.resolve({})),
  getProductionOrders: vi.fn(() => Promise.resolve({ data: [] })),
}));

describe("MachineStatus", () => {
  it("renders machine status page without errors and handles KPI card clicks", async () => {
    render(
      <MemoryRouter>
        <MachineStatus />
      </MemoryRouter>
    );

    // Wait for data load to finish and Total Machines to appear
    await waitFor(() => {
      expect(screen.getByText("Total Machines")).toBeInTheDocument();
    });

    expect(screen.getAllByText("Running").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Idle").length).toBeGreaterThan(0);
    expect(screen.getByText("CNC Milling 1")).toBeInTheDocument();

    // Click Running KPI card
    fireEvent.click(screen.getAllByText("Running")[0]);
    await waitFor(() => {
      expect(screen.getByText("CNC Milling 1")).toBeInTheDocument();
    });

    // Toggle viewMode buttons without crashing
    const gridBtn = screen.getByTitle("Grid view");
    const listBtn = screen.getByTitle("List view");
    expect(gridBtn).toBeInTheDocument();
    expect(listBtn).toBeInTheDocument();

    fireEvent.click(listBtn);
    await waitFor(() => {
      expect(screen.getByText("Rows per page:")).toBeInTheDocument();
    });

    fireEvent.click(gridBtn);
    expect(screen.getByText("CNC Milling 1")).toBeInTheDocument();
  });
});
