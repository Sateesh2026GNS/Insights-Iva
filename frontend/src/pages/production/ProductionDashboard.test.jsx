/** @vitest-environment jsdom */
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetProductionHub = vi.fn();
const mockGetMachines = vi.fn();

vi.mock("../../api/productionApi", () => ({
  getProductionHub: (...args) => mockGetProductionHub(...args),
  getMachines: (...args) => mockGetMachines(...args),
  updateMachineStatus: vi.fn(),
}));

vi.mock("../../hooks/useManufacturingRefresh", () => ({
  default: () => {},
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

import ProductionDashboard from "./ProductionDashboard";

describe("ProductionDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMachines.mockResolvedValue({ data: [] });
    mockGetProductionHub.mockResolvedValue({
      data: {
        production_summary: {
          job_cards_pending: 2,
          job_cards_in_progress: 1,
          produced_today: 50,
          pending_qc: 3,
        },
        action_required: { material_waiting: 1, overdue_production: 0 },
        machines_running: 4,
        machines_idle: 1,
        machines_down: 0,
        running_jobs: 1,
        recent_jobs: [],
      },
    });
  });

  it("uses planner toolkit layout and shows hub KPIs", async () => {
    render(
      <MemoryRouter>
        <ProductionDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: /PRODUCTION/i })).toBeInTheDocument();
    });

    expect(document.querySelector(".ppt-root")).toBeTruthy();
    expect(document.querySelector(".ppt-hero")).toBeTruthy();
    expect(screen.getByLabelText(/Production summary KPIs/i)).toBeInTheDocument();
    expect(screen.getByText("Job Cards Pending")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /Production navigation/i })).toBeInTheDocument();
  });
});
