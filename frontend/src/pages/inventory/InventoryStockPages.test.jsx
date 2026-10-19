import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi } from "vitest";

import LowStockItemsPage from "./LowStockItemsPage";
import OutOfStockItemsPage from "./OutOfStockItemsPage";
import { listInventoryV2Categories, listInventoryV2Items } from "../../api/inventoryV2Api";

vi.mock("../../api/inventoryV2Api", () => ({
  listInventoryV2Items: vi.fn(),
  listInventoryV2Categories: vi.fn(),
  deleteInventoryV2Item: vi.fn(),
  getInventoryV2Item: vi.fn(),
  createInventoryV2Category: vi.fn(),
  addInventoryV2Stock: vi.fn(),
  removeInventoryV2Stock: vi.fn(),
}));

vi.mock("../../hooks/usePageRefresh", () => ({
  default: () => {},
}));

vi.mock("../../hooks/useAuth", () => ({
  default: () => ({
    user: { role: "Admin", permissions: ["inventory", "masters"] },
  }),
}));

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

const itemsFixture = [
  { id: 1, name: "Zero Stock", hsn_code: "Z1", current_stock: 0, min_stock: 2, stock_value: 0 },
  { id: 2, name: "Low Stock", hsn_code: "L1", current_stock: 2, min_stock: 5, stock_value: 20 },
  { id: 3, name: "Healthy", hsn_code: "H1", current_stock: 100, min_stock: 5, stock_value: 1000 },
];

describe("Inventory low / out stock pages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listInventoryV2Items).mockResolvedValue({ data: itemsFixture });
    vi.mocked(listInventoryV2Categories).mockResolvedValue({ data: [] });
  });

  it("Low Stock page shows KPI banner, min stock column, and filtered row", async () => {
    render(
      <MemoryRouter initialEntries={["/inventory/low-stock"]}>
        <LowStockItemsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("columnheader", { name: "Minimum Stock Level" })).toBeInTheDocument();
    });
    expect(screen.getByText(/KPI filter active/i)).toBeInTheDocument();
    expect(screen.getByText("Low Stock")).toBeInTheDocument();
    expect(screen.queryByText("Zero Stock")).not.toBeInTheDocument();
    expect(screen.queryByText("Healthy")).not.toBeInTheDocument();
  });

  it("Out of Stock page shows out-of-stock empty copy when no matches", async () => {
    vi.mocked(listInventoryV2Items).mockResolvedValue({
      data: [{ id: 3, name: "Healthy", hsn_code: "H1", current_stock: 10, min_stock: 1, stock_value: 50 }],
    });

    render(
      <MemoryRouter initialEntries={["/inventory/out-of-stock"]}>
        <OutOfStockItemsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("No out of stock items")).toBeInTheDocument();
    });
    expect(screen.getByText(/All catalog items currently have available stock/i)).toBeInTheDocument();
    expect(screen.queryByText("Minimum Stock Level")).not.toBeInTheDocument();
  });

  it("Out of Stock page lists zero-quantity items without min stock column", async () => {
    render(
      <MemoryRouter initialEntries={["/inventory/out-of-stock"]}>
        <OutOfStockItemsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Zero Stock")).toBeInTheDocument();
    });
    expect(screen.queryByText("Minimum Stock Level")).not.toBeInTheDocument();
    expect(screen.queryByText("Low Stock")).not.toBeInTheDocument();
  });

  it("loads live inventory and categories from the API (single parallel fetch)", async () => {
    render(
      <MemoryRouter initialEntries={["/inventory/low-stock"]}>
        <LowStockItemsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(listInventoryV2Items).toHaveBeenCalled();
    });
    expect(listInventoryV2Categories).toHaveBeenCalled();
    expect(listInventoryV2Items.mock.calls.length).toBe(listInventoryV2Categories.mock.calls.length);
  });
});
