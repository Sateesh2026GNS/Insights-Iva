import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import GodownDashboard from "./GodownDashboard";

vi.mock("../../api/godownToolkitApi", () => ({
  getGodownToolkitDashboard: vi.fn(),
  toolkitError: (error) => error?.message || "The request failed. Check the connection and try again.",
}));

import { getGodownToolkitDashboard } from "../../api/godownToolkitApi";

const empty = {
  active_godowns: { known: true, value: 0 },
  capacity_utilization_pct: { known: false, value: null, reason: "Set a capacity on every active godown before utilization can be shown." },
  stock_quantity: { known: true, value: 0 },
  stock_value: { known: false, value: null, reason: "Valuation is not approved." },
  below_reorder: { known: true, value: 0, reason: "No item has a reorder level above zero." },
  labour_month_actual: { known: true, value: 0 },
  open_gate_passes: { known: true, value: 0 },
  pending_losses: { known: true, value: 0 },
  open_quotations: { known: true, value: 0 },
  recent_movements: [],
  ageing: { known: false, reason: "Stock layers do not store a receipt date, so age cannot be calculated." },
  storage_rent: { known: false, reason: "No approved storage-rent rate is configured." },
  running_cost: { known: false, reason: "Rent, power, and staff costs are not stored as godown running costs." },
};

describe("GodownDashboard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows live counts and leaves unknown figures unconfigured", async () => {
    getGodownToolkitDashboard.mockResolvedValue({ data: empty });
    render(<MemoryRouter><GodownDashboard /></MemoryRouter>);
    expect(screen.getByRole("status")).toHaveTextContent("Loading records");
    expect(await screen.findByRole("heading", { name: "Godown Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Valuation is not approved.")).toBeInTheDocument();
    expect(screen.getByText("No recent stock movements.")).toBeInTheDocument();
    expect(screen.queryByText("₹1,66,13,674")).not.toBeInTheDocument();
  });

  it("shows an error and a retry action", async () => {
    getGodownToolkitDashboard.mockRejectedValue({ message: "Dashboard failed" });
    render(<MemoryRouter><GodownDashboard /></MemoryRouter>);
    expect(await screen.findByRole("alert")).toHaveTextContent("Dashboard failed");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});
