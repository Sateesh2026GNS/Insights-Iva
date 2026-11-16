import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import StockValueByCategoryCard from "./StockValueByCategoryCard";

vi.mock("../../../api/inventoryApi", () => ({
  getStoreStockValueByCategory: vi.fn(),
}));

vi.mock("../../../context/NetworkStatusContext", () => ({
  useNetworkStatus: () => ({ online: true }),
}));

vi.mock("react-i18next", () => {
  // Stable translator identity — avoids fetch/loading loops when `t` is a useCallback dep.
  const t = (key) => key;
  return {
    useTranslation: () => ({ t }),
  };
});

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

    expect(
      await screen.findByText("storeDashboard.stockValueByCategory.title")
    ).toBeInTheDocument();
    expect(await screen.findByText("Electronics")).toBeInTheDocument();
    expect(getStoreStockValueByCategory).toHaveBeenCalledTimes(1);
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

    expect(
      await screen.findByText("storeDashboard.stockValueByCategory.emptyTitle")
    ).toBeInTheDocument();
    expect(getStoreStockValueByCategory).toHaveBeenCalledTimes(1);
  });

  it("shows error with retry when API fails", async () => {
    getStoreStockValueByCategory
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce({
        data: {
          total_value: 1000,
          categories: [{ category: "Electronics", value: 1000, item_count: 1 }],
          has_unvalued: false,
          partial: false,
        },
      });

    render(
      <MemoryRouter>
        <StockValueByCategoryCard />
      </MemoryRouter>
    );

    expect(
      await screen.findByText("storeDashboard.stockValueByCategory.errorTitle")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    expect(getStoreStockValueByCategory).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(getStoreStockValueByCategory).toHaveBeenCalledTimes(2);
      expect(screen.getByText("Electronics")).toBeInTheDocument();
    });
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

    expect(await screen.findByText("Others")).toBeInTheDocument();
  });
});
