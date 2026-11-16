import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import RawMaterials from "./RawMaterials";

vi.mock("../../api/inventoryApi", () => ({
  getRawMaterialsSummary: vi.fn(() =>
    Promise.resolve({ data: { total_items: 2, stock_value: 1000, low_stock: 0, out_of_stock: 0 } })
  ),
  getRawMaterials: vi.fn(() =>
    Promise.resolve({
      data: [
        {
          id: 1,
          name: "Test RM",
          sku: "RM-001",
          category: "Plastics",
          unit: "KG",
          quantity: 100,
          available: 90,
          reserved: 10,
          reorder_level: 50,
          status: "available",
          warehouse_name: "Main",
        },
      ],
    })
  ),
  getWarehouses: vi.fn(() => Promise.resolve({ data: [{ id: 1, name: "Main Warehouse" }] })),
  getRawMaterialDetail: vi.fn(),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../hooks/useManufacturingRefresh", () => ({
  default: () => {},
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => 1,
}));

describe("RawMaterials", () => {
  it("renders after loading live data", async () => {
    render(
      <MemoryRouter>
        <RawMaterials />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText("Test RM").length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Manage and track your raw materials inventory")).toBeInTheDocument();
  });
});
