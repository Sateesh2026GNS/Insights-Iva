import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import InventoryDashboard from "./InventoryDashboard";

vi.mock("../../api/inventoryApi", () => ({
  getStoreDashboard: vi.fn(),
}));

vi.mock("../../hooks/useManufacturingRefresh", () => ({
  default: () => {},
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({ user: { role: "Store Manager" } }),
}));

import { getStoreDashboard } from "../../api/inventoryApi";

describe("InventoryDashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders work-center sections from store dashboard API", async () => {
    getStoreDashboard.mockResolvedValue({
      data: {
        catalog_product_count: 12,
        catalog_low_stock_count: 2,
        catalog_out_of_stock_count: 1,
        pending_inventory_checks: 0,
        pending_material_requests: 0,
        pending_transfers: 0,
        today_movement: {
          stock_in_count: 3,
          stock_out_count: 1,
          stock_in_quantity: 100,
          stock_out_quantity: 40,
        },
        material_check_queue: [],
        low_stock_preview: [],
        pending_material_request_rows: [],
        pending_transfer_rows: [],
        recent_stock_activity: [],
      },
    });

    render(
      <MemoryRouter>
        <InventoryDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Pending Material Checks").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Today's Stock Movement")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Low Stock Items" })).toBeInTheDocument();
    expect(screen.getByText("No pending material checks")).toBeInTheDocument();
  });

  it("shows error state when API fails", async () => {
    getStoreDashboard.mockRejectedValue(new Error("network"));

    render(
      <MemoryRouter>
        <InventoryDashboard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Dashboard unavailable")).toBeInTheDocument();
    });
  });
});
