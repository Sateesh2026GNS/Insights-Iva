import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import CreateProductionOrderModal from "./CreateProductionOrderModal";

vi.mock("../../context/ToastContext", () => ({
  useToast: () => ({ addToast: vi.fn() }),
}));

vi.mock("../../hooks/useTenantId", () => ({
  default: () => "9",
}));

vi.mock("../../api/productionApi", () => ({
  createProductionOrder: vi.fn(),
  updateProductionOrder: vi.fn(),
  getMachines: vi.fn().mockResolvedValue({ data: [] }),
  getOperators: vi.fn().mockResolvedValue({ data: [] }),
}));

vi.mock("../../utils/productOptions", () => ({
  fetchProductsWithFallback: vi.fn().mockResolvedValue([
    { id: 149, name: "Steel rod", sku: "FG-000149", category: "Finished Goods" },
    { id: 162, name: "Cold Rolled Steel Sheet (CRCA 2mm)", sku: "RAW-000162", category: "Raw Material" },
  ]),
  fetchFinishedGoodsWithFallback: vi.fn().mockResolvedValue([
    { id: 149, name: "Steel rod", sku: "FG-000149", category: "Finished Goods" },
    { id: 162, name: "Cold Rolled Steel Sheet (CRCA 2mm)", sku: "RAW-000162", category: "Raw Material" },
  ]),
}));

describe("CreateProductionOrderModal", () => {
  it("renders all products from masters product catalog in dropdown including raw materials", async () => {
    render(<CreateProductionOrderModal open onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText(/Cold Rolled Steel Sheet \(CRCA 2mm\) \(RAW-000162\)/)).toBeInTheDocument();
      expect(screen.getByText(/Steel rod \(FG-000149\)/)).toBeInTheDocument();
    });
  });
});
