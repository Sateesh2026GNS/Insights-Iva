import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import StockValueByCategoryCard from "./StockValueByCategoryCard";

vi.mock("../../../api/inventoryApi", () => ({
  getStoreStockValueByCategory: vi.fn(),
}));

vi.mock("../../../context/NetworkStatusContext", () => ({
  useNetworkStatus: () => ({ online: true }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key) => key,
  }),
}));

import { getStoreStockValueByCategory } from "../../../api/inventoryApi";

describe("StockValueByCategoryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders chart legend for normal data", async () => {
    getStoreStockValueByCategory.mockResolvedValue({
      data: {
        total_value: 1000,
        categories: [
          { category: "Electronics", value: 700, item_count: 2 },
          { category: "Hardware", value: 300, item_count: 1 },
        ],
        has_unvalued: false,
        partial: false,
      },
    });

    render(
      <MemoryRouter>
        <StockValueByCategoryCard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("storeDashboard.stockValueByCategory.title")).toBeInTheDocument();
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });
  });

  it("shows empty state when no stock", async () => {
    getStoreStockValueByCategory.mockResolvedValue({
      data: { total_value: 0, categories: [], has_unvalued: false },
    });

    render(
      <MemoryRouter>
        <StockValueByCategoryCard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("storeDashboard.stockValueByCategory.emptyTitle")).toBeInTheDocument();
    });
  });

  it("shows error with retry when API fails", async () => {
    getStoreStockValueByCategory.mockRejectedValue(new Error("boom"));

    render(
      <MemoryRouter>
        <StockValueByCategoryCard />
      </MemoryRouter>
    );

    // Full-suite CI can be slower; wait until loading skeleton clears and error title appears.
    await waitFor(
      () => {
        expect(
          screen.getByText("storeDashboard.stockValueByCategory.errorTitle")
        ).toBeInTheDocument();
      },
      { timeout: 8000 }
    );
  });

  it("merges Others in legend for many small categories", async () => {
    getStoreStockValueByCategory.mockResolvedValue({
      data: {
        total_value: 1000,
        categories: [
          { category: "A", value: 430, item_count: 1 },
          { category: "B", value: 150, item_count: 1 },
          { category: "C", value: 140, item_count: 1 },
          { category: "D", value: 50, item_count: 1 },
          { category: "E", value: 40, item_count: 1 },
          { category: "F", value: 30, item_count: 1 },
          { category: "G", value: 20, item_count: 1 },
          { category: "H", value: 10, item_count: 1 },
        ],
        has_unvalued: false,
      },
    });

    render(
      <MemoryRouter>
        <StockValueByCategoryCard />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Others")).toBeInTheDocument();
    });
  });
});
